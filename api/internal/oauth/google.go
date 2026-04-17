package oauth

import (
	"context"
	"fmt"
	"net/url"
)

const (
	googleAuthURL  = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL = "https://oauth2.googleapis.com/token"
	googleUserURL  = "https://www.googleapis.com/oauth2/v2/userinfo"
	googleScope    = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
)

type GoogleProvider struct {
	cfg ProviderConfig
}

func NewGoogleProvider(cfg ProviderConfig) *GoogleProvider {
	return &GoogleProvider{cfg: cfg}
}

func (g *GoogleProvider) Name() string { return "google" }

func (g *GoogleProvider) AuthURL(state string) string {
	params := url.Values{
		"client_id":     {g.cfg.ClientID},
		"redirect_uri":  {g.cfg.RedirectURI},
		"response_type": {"code"},
		"scope":         {googleScope},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
		"state":         {state},
	}
	return googleAuthURL + "?" + params.Encode()
}

func (g *GoogleProvider) Exchange(ctx context.Context, code string) (*TokenData, error) {
	data := url.Values{
		"code":          {code},
		"client_id":     {g.cfg.ClientID},
		"client_secret": {g.cfg.ClientSecret},
		"redirect_uri":  {g.cfg.RedirectURI},
		"grant_type":    {"authorization_code"},
	}
	resp, err := httpPostForm(ctx, googleTokenURL, data, nil)
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

func (g *GoogleProvider) GetUserInfo(ctx context.Context, token *TokenData) (*UserInfo, error) {
	resp, err := httpGetJSON(ctx, googleUserURL, token.AccessToken)
	if err != nil {
		return nil, err
	}
	return &UserInfo{
		Email:      strVal(resp, "email"),
		FirstName:  strVal(resp, "given_name"),
		LastName:   strVal(resp, "family_name"),
		Avatar:     strVal(resp, "picture"),
		ProviderID: fmt.Sprintf("%v", resp["id"]),
	}, nil
}

func strVal(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
