// Package github provides GitHub App authentication and HTTP client helpers
// for the Devlane GitHub integration. It is deliberately self-contained — no
// dependency on services or stores — so it can be reused for tests.
package github

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
	"time"
)

// AppAuth holds a GitHub App's identity (ID + private key) and produces
// short-lived JWTs that GitHub accepts as the App's bearer token.
type AppAuth struct {
	AppID      int64
	PrivateKey *rsa.PrivateKey
}

// NewAppAuth parses a PEM-encoded RSA private key and returns an AppAuth.
// The PEM may be PKCS#1 ("-----BEGIN RSA PRIVATE KEY-----") or PKCS#8
// ("-----BEGIN PRIVATE KEY-----"); GitHub serves PKCS#1 by default.
func NewAppAuth(appID int64, privateKeyPEM string) (*AppAuth, error) {
	if appID <= 0 {
		return nil, errors.New("github: app id must be > 0")
	}
	pem := strings.TrimSpace(privateKeyPEM)
	if pem == "" {
		return nil, errors.New("github: private key is empty")
	}
	key, err := parseRSAPrivateKey(pem)
	if err != nil {
		return nil, err
	}
	return &AppAuth{AppID: appID, PrivateKey: key}, nil
}

func parseRSAPrivateKey(pemStr string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("github: invalid PEM block")
	}
	if k, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return k, nil
	}
	if k8, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if k, ok := k8.(*rsa.PrivateKey); ok {
			return k, nil
		}
		return nil, errors.New("github: PKCS#8 key is not RSA")
	}
	return nil, errors.New("github: unsupported private key format (expected RSA PKCS#1 or PKCS#8)")
}

// JWT returns a short-lived (10-minute) JWT signed with the App's private key.
// Use this only to call /app/* endpoints or to exchange for an installation
// token — never to call repo APIs directly.
func (a *AppAuth) JWT(now time.Time) (string, error) {
	if a == nil || a.PrivateKey == nil {
		return "", errors.New("github: app auth is not configured")
	}
	header := map[string]string{"alg": "RS256", "typ": "JWT"}
	// GitHub recommends iat backdated by 60s to allow for clock drift, exp <= 10m.
	claims := map[string]interface{}{
		"iat": now.Add(-60 * time.Second).Unix(),
		"exp": now.Add(9 * time.Minute).Unix(),
		"iss": a.AppID,
	}
	hb, _ := json.Marshal(header)
	cb, _ := json.Marshal(claims)
	signing := base64URLEncode(hb) + "." + base64URLEncode(cb)
	hash := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPKCS1v15(rand.Reader, a.PrivateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", fmt.Errorf("github: sign JWT: %w", err)
	}
	return signing + "." + base64URLEncode(sig), nil
}

func base64URLEncode(b []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(b), "=")
}
