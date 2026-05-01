package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Installation is the App-level metadata about an installation, returned by
// GET /app/installations/:id (App-JWT auth, not installation-token auth).
type Installation struct {
	ID      int64       `json:"id"`
	Account AccountLite `json:"account"`
	// We could expose more fields (target_type, permissions, ...) later but
	// account is the only one the UI needs today.
}

// GetInstallation fetches one installation's metadata via App JWT auth.
func (c *Client) GetInstallation(ctx context.Context, installationID int64) (*Installation, error) {
	jwt, err := c.app.JWT(time.Now().UTC())
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/app/installations/%d", c.apiBase, installationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github: get installation (status %d): %s", resp.StatusCode, string(body))
	}
	var out Installation
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetPullRequest fetches a single PR's full payload via the installation token.
// Used by the manual-link-by-URL flow on the issue detail page.
func (c *Client) GetPullRequest(ctx context.Context, installationID int64, owner, repo string, number int) (*PullRequest, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/pulls/%d", c.apiBase, owner, repo, number)
	resp, err := c.doInstallation(ctx, http.MethodGet, url, installationID, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("github: pull request %s/%s#%d not found or not visible to the installation", owner, repo, number)
	}
	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github: get pull request (status %d): %s", resp.StatusCode, string(body))
	}
	var pr PullRequest
	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil {
		return nil, err
	}
	return &pr, nil
}
