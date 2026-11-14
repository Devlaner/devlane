package service

import (
	"net"
	"testing"
)

// The SSRF guard must reject loopback/private/link-local/unspecified addresses
// and accept public ones. Covers #195.
func TestIsPublicIP(t *testing.T) {
	blocked := []string{"127.0.0.1", "::1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "100.127.255.255"}
	for _, s := range blocked {
		if isPublicIP(net.ParseIP(s)) {
			t.Errorf("%s should be blocked", s)
		}
	}
	for _, s := range []string{"8.8.8.8", "1.1.1.1"} {
		if !isPublicIP(net.ParseIP(s)) {
			t.Errorf("%s should be allowed", s)
		}
	}
}

func TestValidWebhookURL(t *testing.T) {
	for _, ok := range []string{"https://example.com/hook", "http://hooks.example.org/x"} {
		if !validWebhookURL(ok) {
			t.Errorf("%s should be valid", ok)
		}
	}
	for _, bad := range []string{
		"ftp://example.com", "not a url", "", "file:///etc/passwd", "//example.com",
		"http://127.0.0.1/x", "http://10.0.0.5/hook", "https://192.168.1.1/y",
		"http://169.254.169.254/latest/meta-data", "http://[::1]/x", "http://100.64.0.1/x",
	} {
		if validWebhookURL(bad) {
			t.Errorf("%s should be invalid", bad)
		}
	}
}

// IPv6 transition forms that embed a non-public IPv4 must be blocked, while
// the same forms embedding a public IPv4 stay allowed (GHSA-rghx-8986-hhg5).
func TestIsPublicIP_IPv6TransitionForms(t *testing.T) {
	blocked := []string{
		// NAT64 well-known and local-use prefixes
		"64:ff9b::127.0.0.1", "64:ff9b::10.0.0.1", "64:ff9b::169.254.169.254", "64:ff9b::a9fe:a9fe",
		"64:ff9b::192.168.1.1", "64:ff9b::100.64.0.1", "64:ff9b:1::10.0.0.1",
		// 6to4
		"2002:0a00:0001::", "2002:7f00:0001::", "2002:a9fe:a9fe::1", "2002:c0a8:0101::",
		// IPv4-compatible
		"::10.0.0.1", "::127.0.0.1", "::169.254.169.254",
		// IPv4-mapped (already covered by net.IP helpers; keep as a control)
		"::ffff:127.0.0.1", "::ffff:10.0.0.1",
		// Teredo can tunnel to arbitrary IPv4 destinations
		"2001:0:4136:e378:8000:63bf:3fff:fdd2",
		// Other special-purpose ranges
		"::", "::1", "fec0::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1", "100::1",
		"192.0.0.8", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "240.0.0.1", "255.255.255.255",
	}
	for _, s := range blocked {
		ip := net.ParseIP(s)
		if ip == nil {
			t.Fatalf("bad test address %q", s)
		}
		if isPublicIP(ip) {
			t.Errorf("%s should be blocked", s)
		}
	}
	allowed := []string{
		"64:ff9b::8.8.8.8", "2002:0808:0808::1", "::ffff:1.1.1.1",
		"2606:4700:4700::1111", "2001:4860:4860::8888",
	}
	for _, s := range allowed {
		if !isPublicIP(net.ParseIP(s)) {
			t.Errorf("%s should be allowed", s)
		}
	}
}

func TestValidWebhookURL_IPv6TransitionForms(t *testing.T) {
	for _, bad := range []string{
		"http://[64:ff9b::a9fe:a9fe]/latest/meta-data/",
		"http://[64:ff9b::10.0.0.1]/x",
		"http://[2002:7f00:1::]/x",
		"http://[::127.0.0.1]/x",
		"http://[::ffff:169.254.169.254]/x",
	} {
		if validWebhookURL(bad) {
			t.Errorf("%s should be invalid", bad)
		}
	}
}
