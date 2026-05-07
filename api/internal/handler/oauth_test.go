package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOAuth_UnknownProvider404(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/auth/atlassian/", "")
	// resolveProvider returns false for unknown — handler responds 404.
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestOAuth_NotConfigured_Provider404(t *testing.T) {
	ts := testutil.NewTestServer(t)

	// Without instance settings populated, BuildOAuthGoogleProvider returns
	// (nil, false) and Initiate returns 404.
	rr := ts.GET("/auth/google/", "")
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestOAuth_Configured_RedirectsWithStateCookie(t *testing.T) {
	ts := testutil.NewTestServer(t)

	// Seed minimal Google OAuth credentials so BuildOAuthGoogleProvider returns
	// a usable provider. Allow boolean lives under "auth", credentials under "oauth".
	settings := store.NewInstanceSettingStore(ts.DB)
	require.NoError(t, settings.Upsert(context.Background(), "auth", model.JSONMap{
		"google":              true,
		"github":              false,
		"gitlab":              false,
		"magic_code":          true,
		"password":            true,
		"allow_public_signup": true,
	}))
	require.NoError(t, settings.Upsert(context.Background(), "oauth", model.JSONMap{
		"google_client_id":         "test-google-client-id",
		"google_client_secret":     "test-google-secret",
		"google_client_secret_set": true,
	}))

	rr := ts.GET("/auth/google/", "")
	require.Equal(t, http.StatusTemporaryRedirect, rr.Code, "body=%s", rr.Body.String())

	// Should set the oauth_state cookie.
	var found bool
	for _, c := range rr.Result().Cookies() {
		if c.Name == "oauth_state" && c.Value != "" {
			found = true
		}
	}
	assert.True(t, found, "oauth_state cookie missing")

	// Location header should redirect to Google.
	loc := rr.Header().Get("Location")
	assert.Contains(t, loc, "accounts.google.com", "expected redirect to Google: %s", loc)
}
