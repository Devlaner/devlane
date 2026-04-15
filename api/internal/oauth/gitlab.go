package oauth

import (
	"context"
	"fmt"
	"net/url"
	"strings"
)

const gitlabScope = "read_user"

type GitLabProvider struct {
	cfg  ProviderConfig
	host string
}

func NewGitLabProvider(cfg ProviderConfig, host string) *GitLabProvider {
	host = strings.TrimSuffix(host, "/")
	if host == "" {
		host = "https://gitlab.com"
	}
	return &GitLabProvider{cfg: cfg, host: host}
}

func (g *GitLabProvider) Name() string { return "gitlab" }

func (g *GitLabProvider) AuthURL(state string) string {
	params := url.Values{
		"client_id":     {g.cfg.ClientID},
		"redirect_uri":  {g.cfg.RedirectURI},
		"response_type": {"code"},
		"scope":         {gitlabScope},
		"state":         {state},
	}
	return g.host + "/oauth/authorize?" + params.Encode()
}

func (g *GitLabProvider) Exchange(ctx context.Context, code string) (*TokenData, error) {
	data := url.Values{
		"client_id":     {g.cfg.ClientID},
		"client_secret": {g.cfg.ClientSecret},
		"code":          {code},
		"redirect_uri":  {g.cfg.RedirectURI},
		"grant_type":    {"authorization_code"},
	}
	tokenURL := g.host + "/oauth/token"
	resp, err := httpPostForm(ctx, tokenURL, data, map[string]string{"Accept": "application/json"})
	if err != nil {
		return nil, err
	}
	td := &TokenData{
		AccessToken:  strVal(resp, "access_token"),
		RefreshToken: strVal(resp, "refresh_token"),
		IDToken:      strVal(resp, "id_token"),
	}
	return td, nil
}

func (g *GitLabProvider) GetUserInfo(ctx context.Context, token *TokenData) (*UserInfo, error) {
	userURL := g.host + "/api/v4/user"
	resp, err := httpGetJSON(ctx, userURL, token.AccessToken)
	if err != nil {
		return nil, err
	}
	return &UserInfo{
		Email:      strVal(resp, "email"),
		FirstName:  strVal(resp, "name"),
		Avatar:     strVal(resp, "avatar_url"),
		ProviderID: fmt.Sprintf("%v", resp["id"]),
	}, nil
}
