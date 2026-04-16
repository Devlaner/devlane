package handler

import (
	"context"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/oauth"
	"github.com/Devlaner/devlane/api/internal/store"
)

func loadOAuthSettingsMap(ctx context.Context, st *store.InstanceSettingStore) model.JSONMap {
	if st == nil {
		return nil
	}
	row, err := st.Get(ctx, "oauth")
	if err != nil || row == nil || row.Value == nil {
		return nil
	}
	return decryptSectionSecrets("oauth", row.Value)
}

func jsonString(m model.JSONMap, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func oauthRedirectURI(callbackBase, provider string) string {
	b := strings.TrimSuffix(strings.TrimSpace(callbackBase), "/")
	return b + "/auth/" + provider + "/callback/"
}

// BuildOAuthGoogleProvider returns a configured Google provider from DB instance settings.
func BuildOAuthGoogleProvider(ctx context.Context, st *store.InstanceSettingStore, callbackBase string) (oauth.Provider, bool) {
	m := loadOAuthSettingsMap(ctx, st)
	id := jsonString(m, "google_client_id")
	sec := jsonString(m, "google_client_secret")
	if id == "" || sec == "" {
		return nil, false
	}
	return oauth.NewGoogleProvider(oauth.ProviderConfig{
		ClientID:     id,
		ClientSecret: sec,
		RedirectURI:  oauthRedirectURI(callbackBase, "google"),
	}), true
}

// BuildOAuthGitHubProvider returns a configured GitHub provider from DB instance settings.
func BuildOAuthGitHubProvider(ctx context.Context, st *store.InstanceSettingStore, callbackBase string) (oauth.Provider, bool) {
	m := loadOAuthSettingsMap(ctx, st)
	id := jsonString(m, "github_client_id")
	sec := jsonString(m, "github_client_secret")
	if id == "" || sec == "" {
		return nil, false
	}
	return oauth.NewGitHubProvider(oauth.ProviderConfig{
		ClientID:     id,
		ClientSecret: sec,
		RedirectURI:  oauthRedirectURI(callbackBase, "github"),
	}), true
}

// BuildOAuthGitLabProvider returns a configured GitLab provider from DB instance settings.
func BuildOAuthGitLabProvider(ctx context.Context, st *store.InstanceSettingStore, callbackBase string) (oauth.Provider, bool) {
	m := loadOAuthSettingsMap(ctx, st)
	id := jsonString(m, "gitlab_client_id")
	sec := jsonString(m, "gitlab_client_secret")
	host := jsonString(m, "gitlab_host")
	if id == "" || sec == "" {
		return nil, false
	}
	return oauth.NewGitLabProvider(oauth.ProviderConfig{
		ClientID:     id,
		ClientSecret: sec,
		RedirectURI:  oauthRedirectURI(callbackBase, "gitlab"),
	}, host), true
}

func oauthGoogleCredentialsReady(ctx context.Context, st *store.InstanceSettingStore) bool {
	m := loadOAuthSettingsMap(ctx, st)
	id := jsonString(m, "google_client_id")
	sec := jsonString(m, "google_client_secret")
	return id != "" && sec != ""
}

func oauthGitHubCredentialsReady(ctx context.Context, st *store.InstanceSettingStore) bool {
	m := loadOAuthSettingsMap(ctx, st)
	id := jsonString(m, "github_client_id")
	sec := jsonString(m, "github_client_secret")
	return id != "" && sec != ""
}

func oauthGitLabCredentialsReady(ctx context.Context, st *store.InstanceSettingStore) bool {
	m := loadOAuthSettingsMap(ctx, st)
	id := jsonString(m, "gitlab_client_id")
	sec := jsonString(m, "gitlab_client_secret")
	return id != "" && sec != ""
}
