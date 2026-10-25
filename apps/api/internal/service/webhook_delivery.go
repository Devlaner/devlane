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

func isPublicIP(ip net.IP) bool {
	if ip == nil || ip.IsLoopback() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsPrivate() {
		return false
	}
	// Block CGNAT shared address space (RFC 6598, 100.64.0.0/10), which
	// ip.IsPrivate() does not cover but some providers use for internal services.
	if v4 := ip.To4(); v4 != nil && v4[0] == 100 && v4[1] >= 64 && v4[1] <= 127 {
		return false
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
