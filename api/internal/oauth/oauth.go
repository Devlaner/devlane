package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrProviderNotConfigured = errors.New("oauth provider not configured")
	ErrStateMismatch         = errors.New("oauth state mismatch")
	ErrCodeMissing           = errors.New("oauth code missing")
	ErrTokenExchange         = errors.New("oauth token exchange failed")
	ErrUserInfo              = errors.New("oauth user info fetch failed")
)

// oauthHTTPClient bounds OAuth HTTP latency; requests also respect ctx cancellation.
var oauthHTTPClient = &http.Client{Timeout: 30 * time.Second}

type UserInfo struct {
	Email      string
	FirstName  string
	LastName   string
	Avatar     string
	ProviderID string
}

type TokenData struct {
	AccessToken  string
	RefreshToken string
	IDToken      string
	ExpiresAt    *time.Time
}

type ProviderConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

func httpPostForm(ctx context.Context, tokenURL string, data url.Values, extraHeaders map[string]string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}
	resp, err := oauthHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("%w: %s", ErrTokenExchange, string(body))
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse token response: %w", err)
	}
	return result, nil
}

func httpGetJSON(ctx context.Context, urlStr string, token string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := oauthHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("%w: %s", ErrUserInfo, string(body))
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse user info: %w", err)
	}
	return result, nil
}

type Provider interface {
	Name() string
	AuthURL(state string) string
	Exchange(ctx context.Context, code string) (*TokenData, error)
	GetUserInfo(ctx context.Context, token *TokenData) (*UserInfo, error)
}
