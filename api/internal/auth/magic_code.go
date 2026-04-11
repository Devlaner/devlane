package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// DefaultMagicCodeHMACKey is used when MAGIC_CODE_SECRET is unset (development only).
const DefaultMagicCodeHMACKey = "devlane-insecure-magic-code-hmac-key-change-in-production"

// NormalizeMagicCode strips spaces and hyphens so users can paste formatted codes.
func NormalizeMagicCode(code string) string {
	s := strings.TrimSpace(code)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "-", "")
	return s
}

// MagicCodeHMAC returns a hex-encoded HMAC-SHA256 of the normalized email and code.
func MagicCodeHMAC(secret, email, code string) string {
	e := strings.ToLower(strings.TrimSpace(email))
	c := NormalizeMagicCode(code)
	key := strings.TrimSpace(secret)
	if key == "" {
		key = DefaultMagicCodeHMACKey
	}
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte(e))
	_, _ = mac.Write([]byte{0})
	_, _ = mac.Write([]byte(c))
	return hex.EncodeToString(mac.Sum(nil))
}
