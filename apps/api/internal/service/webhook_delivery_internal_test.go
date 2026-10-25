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
