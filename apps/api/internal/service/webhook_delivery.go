package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/queue"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

const (
	webhookDeliverTimeout = 10 * time.Second
	webhookMaxAttempts    = 3
	webhookMaxResponseLog = 4096
)

// NewWebhookDeliverer returns a delivery function for the webhook queue: it
// signs the payload (HMAC-SHA256), POSTs it with retries to a public URL only
// (SSRF-guarded), and records the attempt in webhook_logs.
func NewWebhookDeliverer(webhooks *store.WebhookStore, log *slog.Logger) func(ctx context.Context, p queue.WebhookPayload) error {
	client := &http.Client{
		Timeout: webhookDeliverTimeout,
		Transport: &http.Transport{
			DialContext:       safeDialContext,
			DisableKeepAlives: true,
		},
		// Don't follow redirects: a 3xx to an internal host would bypass the
		// SSRF check on the original URL.
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	return func(ctx context.Context, p queue.WebhookPayload) error {
		body, err := json.Marshal(p.Payload)
		if err != nil {
			return err
		}
		sig := ""
		if strings.TrimSpace(p.Secret) != "" {
			mac := hmac.New(sha256.New, []byte(p.Secret))
			_, _ = mac.Write(body)
			sig = "sha256=" + hex.EncodeToString(mac.Sum(nil))
		}

		// One delivery ID for the whole delivery, stable across retries, so
		// receivers can dedupe: retrying an attempt must not look like a new event.
		deliveryID := uuid.New().String()

		var lastErr error
		var status, respHeaders, respBody string
		attempts := 0
		for attempts < webhookMaxAttempts {
			attempts++
			status, respHeaders, respBody, lastErr = deliverOnce(ctx, client, p, body, sig, deliveryID)
			if lastErr == nil && strings.HasPrefix(status, "2") {
				break
			}
			if attempts < webhookMaxAttempts {
				time.Sleep(time.Duration(attempts) * 500 * time.Millisecond)
			}
		}

		writeWebhookLog(ctx, webhooks, log, p, body, sig, deliveryID, status, respHeaders, respBody, attempts-1, lastErr)
		return nil // delivery is best-effort; failures are recorded, not retried by the queue
	}
}

func deliverOnce(ctx context.Context, client *http.Client, p queue.WebhookPayload, body []byte, sig, deliveryID string) (status, respHeaders, respBody string, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.URL, bytes.NewReader(body))
	if err != nil {
		return "", "", "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Devlane-Webhook/"+"v1")
	req.Header.Set("X-Devlane-Event", p.Event)
	req.Header.Set("X-Devlane-Delivery", deliveryID)
	if sig != "" {
		req.Header.Set("X-Devlane-Signature", sig)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(resp.Body, webhookMaxResponseLog))
	return fmt.Sprintf("%d", resp.StatusCode), headerString(resp.Header), string(rb), nil
}

func writeWebhookLog(ctx context.Context, webhooks *store.WebhookStore, log *slog.Logger, p queue.WebhookPayload, body []byte, sig, deliveryID, status, respHeaders, respBody string, retries int, deliverErr error) {
	whID, err1 := uuid.Parse(p.WebhookID)
	wsID, err2 := uuid.Parse(p.WorkspaceID)
	if err1 != nil || err2 != nil || webhooks == nil {
		return
	}
	if status == "" && deliverErr != nil {
		status = "error: " + deliverErr.Error()
	}
	reqHeaders := "Content-Type: application/json\nX-Devlane-Event: " + p.Event +
		"\nX-Devlane-Delivery: " + deliveryID
	if sig != "" {
		reqHeaders += "\nX-Devlane-Signature: " + sig
	}
	entry := &model.WebhookLog{
		WebhookID:       whID,
		WorkspaceID:     wsID,
		EventType:       p.Event,
		RequestMethod:   http.MethodPost,
		RequestHeaders:  reqHeaders,
		RequestBody:     string(body),
		ResponseStatus:  status,
		ResponseHeaders: respHeaders,
		ResponseBody:    respBody,
		RetryCount:      retries,
	}
	if err := webhooks.CreateLog(ctx, entry); err != nil && log != nil {
		log.Warn("webhook log write", "error", err)
	}
}

func headerString(h http.Header) string {
	var b strings.Builder
	for k, vals := range h {
		b.WriteString(k)
		b.WriteString(": ")
		b.WriteString(strings.Join(vals, ","))
		b.WriteString("\n")
	}
	return b.String()
}

// safeDialContext resolves the target and refuses to connect to non-public
// addresses, blocking SSRF (including DNS rebinding, since it dials the very IP
// it validated).
func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	for _, ip := range ips {
		if !isPublicIP(ip.IP) {
			return nil, fmt.Errorf("webhook target %s resolves to a non-public address", host)
		}
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("webhook target %s did not resolve", host)
	}
	d := net.Dialer{Timeout: 5 * time.Second}
	return d.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
}

// nonPublicPrefixes are special-purpose ranges (RFC 6890 and friends) that
// a webhook must never reach, beyond what net.IP's helpers already cover.
var nonPublicPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),       // "this network"
	netip.MustParsePrefix("100.64.0.0/10"),   // CGNAT shared space (RFC 6598)
	netip.MustParsePrefix("192.0.0.0/24"),    // IETF protocol assignments
	netip.MustParsePrefix("192.0.2.0/24"),    // TEST-NET-1
	netip.MustParsePrefix("198.18.0.0/15"),   // benchmarking
	netip.MustParsePrefix("198.51.100.0/24"), // TEST-NET-2
	netip.MustParsePrefix("203.0.113.0/24"),  // TEST-NET-3
	netip.MustParsePrefix("240.0.0.0/4"),     // reserved + limited broadcast
	netip.MustParsePrefix("100::/64"),        // IPv6 discard-only
	netip.MustParsePrefix("2001:db8::/32"),   // IPv6 documentation
	netip.MustParsePrefix("2001::/32"),       // Teredo (tunnels to arbitrary IPv4)
	netip.MustParsePrefix("2001:10::/28"),    // ORCHID
	netip.MustParsePrefix("2001:20::/28"),    // ORCHIDv2
	netip.MustParsePrefix("fec0::/10"),       // deprecated site-local
}

// embeddedIPv4 returns the IPv4 destination carried by an IPv6 transition
// address, or false if ip is not one. Covered forms: IPv4-mapped
// (::ffff:0:0/96), IPv4-compatible (::/96), NAT64 well-known and local-use
// prefixes (64:ff9b::/96, 64:ff9b:1::/48) and 6to4 (2002::/16).
func embeddedIPv4(ip netip.Addr) (netip.Addr, bool) {
	if !ip.Is6() {
		return netip.Addr{}, false
	}
	b := ip.As16()
	switch {
	case ip.Is4In6():
		return ip.Unmap(), true
	case netip.MustParsePrefix("::/96").Contains(ip):
		return netip.AddrFrom4([4]byte{b[12], b[13], b[14], b[15]}), true
	case netip.MustParsePrefix("64:ff9b::/96").Contains(ip),
		netip.MustParsePrefix("64:ff9b:1::/48").Contains(ip):
		return netip.AddrFrom4([4]byte{b[12], b[13], b[14], b[15]}), true
	case netip.MustParsePrefix("2002::/16").Contains(ip):
		return netip.AddrFrom4([4]byte{b[2], b[3], b[4], b[5]}), true
	}
	return netip.Addr{}, false
}

// isPublicIP reports whether ip is a globally routable unicast address that a
// webhook may be delivered to. IPv6 transition forms that embed an IPv4
// address are judged by the embedded address, so e.g. 64:ff9b::10.0.0.1 or
// 2002:7f00:1:: cannot be used to reach internal IPv4 hosts.
func isPublicIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	return isPublicAddr(addr.WithZone(""))
}

func isPublicAddr(addr netip.Addr) bool {
	if v4, ok := embeddedIPv4(addr); ok {
		// "::" and "::1" fall in ::/96 but are IPv6 unspecified/loopback.
		if addr.IsUnspecified() || addr.IsLoopback() {
			return false
		}
		return isPublicAddr(v4)
	}
	if !addr.IsValid() || addr.IsLoopback() || addr.IsUnspecified() || addr.IsLinkLocalUnicast() ||
		addr.IsLinkLocalMulticast() || addr.IsInterfaceLocalMulticast() || addr.IsMulticast() || addr.IsPrivate() {
		return false
	}
	for _, p := range nonPublicPrefixes {
		if p.Contains(addr) {
			return false
		}
	}
	return true
}

// validWebhookURL reports whether raw is an http(s) URL that isn't obviously
// internal. The connect-time SSRF guard is the real enforcement (it also covers
// DNS rebinding, which a create-time check cannot); this rejects bad input and
// literal private/loopback IPs early so admins get a clear error instead of a
// webhook that silently fails every delivery.
func validWebhookURL(raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	if u.Host == "" {
		return false
	}
	// Reject literal IP hosts that are non-public. Hostnames are left to the
	// connect-time resolver guard, since they can resolve differently later.
	if ip := net.ParseIP(u.Hostname()); ip != nil && !isPublicIP(ip) {
		return false
	}
	return true
}
