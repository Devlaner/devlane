package github

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
)

// VerifySignature validates a GitHub webhook payload against the configured
// secret. The signature is sent as `X-Hub-Signature-256: sha256=<hex>`.
//
// Returns nil only when the secret is non-empty AND the signature matches
// (constant-time compare). If secret is empty, returns an error — never
// fall through silently in production paths.
func VerifySignature(secret string, payload []byte, signatureHeader string) error {
	if secret == "" {
		return errors.New("github: webhook secret is not configured")
	}
	if signatureHeader == "" {
		return errors.New("github: missing X-Hub-Signature-256 header")
	}
	const prefix = "sha256="
	if !strings.HasPrefix(signatureHeader, prefix) {
		return errors.New("github: signature header missing sha256= prefix")
	}
	want, err := hex.DecodeString(signatureHeader[len(prefix):])
	if err != nil {
		return errors.New("github: signature header is not valid hex")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	got := mac.Sum(nil)
	if !hmac.Equal(want, got) {
		return errors.New("github: signature mismatch")
	}
	return nil
}
