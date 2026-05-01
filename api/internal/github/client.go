package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"
)

const (
	defaultAPIBase   = "https://api.github.com"
	defaultUserAgent = "Devlane/1.0 (+https://github.com/Devlaner/devlane)"
)

// Repository is a trimmed-down GitHub repository payload (only fields we use).
type Repository struct {
	ID       int64  `json:"id"`
	NodeID   string `json:"node_id"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Private  bool   `json:"private"`
	HTMLURL  string `json:"html_url"`
	Owner    struct {
		Login     string `json:"login"`
		ID        int64  `json:"id"`
		Type      string `json:"type"`
		AvatarURL string `json:"avatar_url"`
	} `json:"owner"`
	Description   string    `json:"description"`
	DefaultBranch string    `json:"default_branch"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// installationToken is the response from POST /app/installations/:id/access_tokens.
type installationToken struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// cachedToken is what we keep in memory; we refresh ~5 min before expiry.
type cachedToken struct {
	token     string
	expiresAt time.Time
}

// Client is an HTTP wrapper around the GitHub REST API authenticated as a
// specific App installation. Tokens are cached in-memory per-installation and
// refreshed lazily.
type Client struct {
	app        *AppAuth
	httpClient *http.Client
	apiBase    string

	mu     sync.Mutex
	tokens map[int64]cachedToken
}

// NewClient builds a Client for the given AppAuth. Pass nil for httpClient to
// use http.DefaultClient.
func NewClient(app *AppAuth, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &Client{
		app:        app,
		httpClient: httpClient,
		apiBase:    defaultAPIBase,
		tokens:     make(map[int64]cachedToken),
	}
}

// SetAPIBase overrides the base URL (useful for tests or GitHub Enterprise).
func (c *Client) SetAPIBase(base string) { c.apiBase = base }

// InstallationToken returns a fresh installation token, using the cache when possible.
func (c *Client) InstallationToken(ctx context.Context, installationID int64) (string, error) {
	c.mu.Lock()
	if t, ok := c.tokens[installationID]; ok && time.Until(t.expiresAt) > 5*time.Minute {
		c.mu.Unlock()
		return t.token, nil
	}
	c.mu.Unlock()

	jwt, err := c.app.JWT(time.Now().UTC())
	if err != nil {
		return "", err
	}
	url := fmt.Sprintf("%s/app/installations/%d/access_tokens", c.apiBase, installationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("github: installation token (status %d): %s", resp.StatusCode, string(body))
	}
	var tk installationToken
	if err := json.NewDecoder(resp.Body).Decode(&tk); err != nil {
		return "", err
	}
	c.mu.Lock()
	c.tokens[installationID] = cachedToken{token: tk.Token, expiresAt: tk.ExpiresAt}
	c.mu.Unlock()
	return tk.Token, nil
}

// InvalidateInstallation drops a cached token (call on suspend / uninstall).
func (c *Client) InvalidateInstallation(installationID int64) {
	c.mu.Lock()
	delete(c.tokens, installationID)
	c.mu.Unlock()
}

// doInstallation performs an authenticated request as the installation.
// page == 0 / perPage == 0 means "no pagination params".
func (c *Client) doInstallation(ctx context.Context, method, url string, installationID int64, body any) (*http.Response, error) {
	token, err := c.InstallationToken(ctx, installationID)
	if err != nil {
		return nil, err
	}
	var rdr io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		rdr = bytes.NewReader(buf)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, rdr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if rdr != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.httpClient.Do(req)
}

// ListInstallationRepositories fetches one page of an installation's accessible repos.
// Page is 1-based; perPage caps at 100.
func (c *Client) ListInstallationRepositories(ctx context.Context, installationID int64, page, perPage int) ([]Repository, int, error) {
	if perPage <= 0 || perPage > 100 {
		perPage = 30
	}
	if page <= 0 {
		page = 1
	}
	url := fmt.Sprintf("%s/installation/repositories?per_page=%d&page=%d", c.apiBase, perPage, page)
	resp, err := c.doInstallation(ctx, http.MethodGet, url, installationID, nil)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(resp.Body)
		return nil, 0, fmt.Errorf("github: list installation repos (status %d): %s", resp.StatusCode, string(body))
	}
	var payload struct {
		TotalCount   int          `json:"total_count"`
		Repositories []Repository `json:"repositories"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, 0, err
	}
	return payload.Repositories, payload.TotalCount, nil
}

// CreateIssueComment posts a comment on an issue or PR (same endpoint).
func (c *Client) CreateIssueComment(ctx context.Context, installationID int64, owner, repo string, issueNumber int, body string) error {
	url := fmt.Sprintf("%s/repos/%s/%s/issues/%d/comments", c.apiBase, owner, repo, issueNumber)
	resp, err := c.doInstallation(ctx, http.MethodPost, url, installationID, map[string]string{"body": body})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github: create issue comment (status %d): %s", resp.StatusCode, string(b))
	}
	return nil
}

// ParseInstallationID extracts an installation_id query param.
func ParseInstallationID(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}
