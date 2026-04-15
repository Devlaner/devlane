package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

const (
	githubAuthURL  = "https://github.com/login/oauth/authorize"
	githubTokenURL = "https://github.com/login/oauth/access_token"
	githubUserURL  = "https://api.github.com/user"
	githubEmailURL = "https://api.github.com/user/emails"
	githubScope    = "read:user user:email"
)

type GitHubProvider struct {
	cfg ProviderConfig
}

func NewGitHubProvider(cfg ProviderConfig) *GitHubProvider {
	return &GitHubProvider{cfg: cfg}
}

func (g *GitHubProvider) Name() string { return "github" }

func (g *GitHubProvider) AuthURL(state string) string {
	params := url.Values{
		"client_id":    {g.cfg.ClientID},
		"redirect_uri": {g.cfg.RedirectURI},
		"scope":        {githubScope},
		"state":        {state},
	}
	return githubAuthURL + "?" + params.Encode()
}

func (g *GitHubProvider) Exchange(ctx context.Context, code string) (*TokenData, error) {
	data := url.Values{
		"client_id":     {g.cfg.ClientID},
		"client_secret": {g.cfg.ClientSecret},
		"code":          {code},
		"redirect_uri":  {g.cfg.RedirectURI},
	}
	resp, err := httpPostForm(ctx, githubTokenURL, data, map[string]string{"Accept": "application/json"})
	if err != nil {
		return nil, err
	}
	td := &TokenData{
		AccessToken:  strVal(resp, "access_token"),
		RefreshToken: strVal(resp, "refresh_token"),
	}
	return td, nil
}

func (g *GitHubProvider) GetUserInfo(ctx context.Context, token *TokenData) (*UserInfo, error) {
	resp, err := httpGetJSON(ctx, githubUserURL, token.AccessToken)
	if err != nil {
		return nil, err
	}
	email := strVal(resp, "email")
	if email == "" {
		email, _ = g.fetchPrimaryEmail(ctx, token.AccessToken)
	}
	return &UserInfo{
		Email:      email,
		FirstName:  strVal(resp, "name"),
		Avatar:     strVal(resp, "avatar_url"),
		ProviderID: fmt.Sprintf("%v", resp["id"]),
	}, nil
}

func (g *GitHubProvider) fetchPrimaryEmail(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, githubEmailURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := oauthHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := json.Unmarshal(body, &emails); err != nil {
		return "", err
	}
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}
	for _, e := range emails {
		if e.Primary {
			return e.Email, nil
		}
	}
	return "", fmt.Errorf("no primary email found")
}
