package oauth

import (
	"context"
	"errors"
	"net/url"
)

const (
	slackAuthURL  = "https://slack.com/oauth/v2/authorize"
	slackTokenURL = "https://slack.com/api/oauth.v2.access"
)

type SlackProvider struct {
	cfg ProviderConfig
}

func NewSlackProvider(cfg ProviderConfig) *SlackProvider {
	return &SlackProvider{cfg: cfg}
}

func (s *SlackProvider) Name() string { return "slack" }

func (s *SlackProvider) AuthURL(state string) string {
	params := url.Values{
		"client_id":    {s.cfg.ClientID},
		"redirect_uri": {s.cfg.RedirectURI},
		"state":        {state},
		"scope":        {"chat:write,channels:read,groups:read"},
	}

	return slackAuthURL + "?" + params.Encode()
}

func (s *SlackProvider) Exchange(ctx context.Context, code string) (*TokenData, error) {
	data := url.Values{
		"client_id":     {s.cfg.ClientID},
		"client_secret": {s.cfg.ClientSecret},
		"code":          {code},
		"redirect_uri":  {s.cfg.RedirectURI},
	}

	resp, err := httpPostForm(ctx, slackTokenURL, data, map[string]string{"Accept": "application/json"})
	if err != nil {
		return nil, err
	}

	td := &TokenData{
		AccessToken:  strVal(resp, "access_token"),
		RefreshToken: strVal(resp, "refresh_token"),
	}

	return td, nil
}

func (s *SlackProvider) GetUserInfo(ctx context.Context, token *TokenData) (*UserInfo, error) {
	return nil, errors.New("GetUserInfo is not implemented for Slack because it is only used for bot installation")
}
