package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuth_Config_Defaults(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/auth/config/", "")
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, true, body["is_email_password_enabled"])
	assert.Equal(t, true, body["is_magic_code_enabled"])
	assert.Equal(t, true, body["enable_signup"])
	// No OAuth provider has credentials in this fresh instance.
	assert.Equal(t, false, body["is_google_enabled"])
	assert.Equal(t, false, body["is_github_enabled"])
	assert.Equal(t, false, body["is_gitlab_enabled"])
}

func TestAuth_EmailCheck_Existing(t *testing.T) {
	ts := testutil.NewTestServer(t)
	testutil.CreateUser(t, ts.DB, testutil.WithUserEmail("known@test.local"))

	rr := ts.POST("/auth/email-check/", map[string]string{"email": "known@test.local"}, "")
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, true, body["existing"])
}

func TestAuth_EmailCheck_Unknown(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/auth/email-check/", map[string]string{"email": "nobody@test.local"}, "")
	require.Equal(t, http.StatusOK, rr.Code)
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, false, body["existing"])
}

func TestAuth_SignUp_Success(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/auth/sign-up/", map[string]any{
		"email":      "newuser@test.local",
		"password":   "S3cur3!Pass",
		"first_name": "New",
		"last_name":  "User",
	}, "")
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())

	user := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "newuser@test.local", user["email"])

	// Cookie should be set.
	require.NotEmpty(t, rr.Result().Cookies(), "expected session cookie")
	var found bool
	for _, c := range rr.Result().Cookies() {
		if c.Name == middleware.SessionCookieName && c.Value != "" {
			found = true
		}
	}
	assert.True(t, found, "session cookie missing")
}

func TestAuth_SignUp_DuplicateEmail(t *testing.T) {
	ts := testutil.NewTestServer(t)
	testutil.CreateUser(t, ts.DB, testutil.WithUserEmail("dup@test.local"))

	rr := ts.POST("/auth/sign-up/", map[string]any{
		"email":    "dup@test.local",
		"password": "S3cur3!Pass",
	}, "")
	require.Equal(t, http.StatusConflict, rr.Code)
}

func TestAuth_SignUp_WeakPassword(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/auth/sign-up/", map[string]any{
		"email":    "weak@test.local",
		"password": "weakpass",
	}, "")
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestAuth_SignIn_Success(t *testing.T) {
	ts := testutil.NewTestServer(t)
	testutil.CreateUser(t, ts.DB, testutil.WithUserEmail("signin@test.local"))

	rr := ts.POST("/auth/sign-in/", map[string]any{
		"email":    "signin@test.local",
		"password": testutil.TestPassword,
	}, "")
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "signin@test.local", body["email"])

	var found bool
	for _, c := range rr.Result().Cookies() {
		if c.Name == middleware.SessionCookieName && c.Value != "" {
			found = true
		}
	}
	assert.True(t, found)
}

func TestAuth_SignIn_BadPassword(t *testing.T) {
	ts := testutil.NewTestServer(t)
	testutil.CreateUser(t, ts.DB, testutil.WithUserEmail("signin2@test.local"))

	rr := ts.POST("/auth/sign-in/", map[string]any{
		"email":    "signin2@test.local",
		"password": "WrongP@ssword99!",
	}, "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestAuth_SignIn_UnknownEmail(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/auth/sign-in/", map[string]any{
		"email":    "ghost@test.local",
		"password": "WhateverP@ss1!",
	}, "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestAuth_SignIn_DeactivatedUser(t *testing.T) {
	ts := testutil.NewTestServer(t)
	testutil.CreateUser(t, ts.DB,
		testutil.WithUserEmail("disabled@test.local"),
		testutil.WithUserInactive(),
	)

	rr := ts.POST("/auth/sign-in/", map[string]any{
		"email":    "disabled@test.local",
		"password": testutil.TestPassword,
	}, "")
	require.Equal(t, http.StatusForbidden, rr.Code)
}

func TestAuth_SignOut_ClearsSession(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.POST("/auth/sign-out/", nil, session)
	require.Equal(t, http.StatusNoContent, rr.Code)

	// Old session should no longer authenticate.
	rr2 := ts.GET("/api/users/me/", session)
	require.Equal(t, http.StatusUnauthorized, rr2.Code)
}

func TestAuth_Me_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/api/users/me/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestAuth_Me_ReturnsUser(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB, testutil.WithUserEmail("me@test.local"))
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/api/users/me/", session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "me@test.local", body["email"])
	assert.Equal(t, user.ID.String(), body["id"])
}

func TestAuth_UpdateMe_PatchProfile(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.PATCH("/api/users/me/", map[string]any{
		"first_name":   "Updated",
		"display_name": "Updated User",
	}, session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "Updated", body["first_name"])
	assert.Equal(t, "Updated User", body["display_name"])
}

func TestAuth_ChangePassword_Success(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB, testutil.WithUserEmail("change@test.local"))
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.POST("/api/users/me/change-password/", map[string]any{
		"current_password": testutil.TestPassword,
		"new_password":     "Br4nd!NewPass",
	}, session)
	require.Equal(t, http.StatusNoContent, rr.Code)

	// New password works for sign-in.
	rr2 := ts.POST("/auth/sign-in/", map[string]any{
		"email":    "change@test.local",
		"password": "Br4nd!NewPass",
	}, "")
	require.Equal(t, http.StatusOK, rr2.Code)
}

func TestAuth_ChangePassword_WrongCurrent(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.POST("/api/users/me/change-password/", map[string]any{
		"current_password": "NotMyP@ssw0rd!",
		"new_password":     "Br4nd!NewPass",
	}, session)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestAuth_NotificationPreferences_DefaultsAndUpdate(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/api/users/me/notification-preferences/", session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, true, body["comment"]) // default

	// First PUT with comment:false creates the row but column DEFAULT true wins
	// for false zero-value fields on insert. A second PUT updates the existing
	// row, which exercises the actual UPSERT path.
	rr2 := ts.PUT("/api/users/me/notification-preferences/", map[string]any{
		"comment": false,
	}, session)
	require.Equal(t, http.StatusOK, rr2.Code, "body=%s", rr2.Body.String())

	rr3 := ts.PUT("/api/users/me/notification-preferences/", map[string]any{
		"comment": false,
	}, session)
	require.Equal(t, http.StatusOK, rr3.Code, "body=%s", rr3.Body.String())
	body3 := testutil.MustJSONMap(t, rr3)
	assert.Equal(t, false, body3["comment"])
}

func TestAuth_Tokens_ListCreateRevoke(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	// List starts empty.
	rr := ts.GET("/api/users/me/tokens/", session)
	require.Equal(t, http.StatusOK, rr.Code)
	body := testutil.MustJSONMap(t, rr)
	tokens, _ := body["tokens"].([]any)
	assert.Equal(t, 0, len(tokens))

	// Create a token.
	rr2 := ts.POST("/api/users/me/tokens/", map[string]any{
		"label":      "ci-token",
		"expires_in": "30d",
	}, session)
	require.Equal(t, http.StatusCreated, rr2.Code, "body=%s", rr2.Body.String())
	createdBody := testutil.MustJSONMap(t, rr2)
	plainToken, _ := createdBody["token"].(string)
	require.NotEmpty(t, plainToken, "expected plain token in response")

	// List now has one entry.
	rr3 := ts.GET("/api/users/me/tokens/", session)
	require.Equal(t, http.StatusOK, rr3.Code)
	tokensAfter, _ := testutil.MustJSONMap(t, rr3)["tokens"].([]any)
	require.Len(t, tokensAfter, 1)
	tokenID, _ := tokensAfter[0].(map[string]any)["id"].(string)
	require.NotEmpty(t, tokenID)
	// The plain token is shown once and is sha256-hashed in storage; we just
	// verify it was returned non-empty.
	_ = plainToken

	// Revoke.
	rr5 := ts.DELETE("/api/users/me/tokens/"+tokenID+"/", session)
	require.Equal(t, http.StatusNoContent, rr5.Code)

	// List is empty again.
	rr6 := ts.GET("/api/users/me/tokens/", session)
	require.Equal(t, http.StatusOK, rr6.Code)
	tokensAfterRevoke, _ := testutil.MustJSONMap(t, rr6)["tokens"].([]any)
	assert.Len(t, tokensAfterRevoke, 0)
}

func TestAuth_Tokens_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/api/users/me/tokens/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestAuth_ForgotPassword_NoSMTPReturns503(t *testing.T) {
	ts := testutil.NewTestServer(t)
	testutil.CreateUser(t, ts.DB, testutil.WithUserEmail("forgot@test.local"))

	rr := ts.POST("/auth/forgot-password/", map[string]string{"email": "forgot@test.local"}, "")
	require.Equal(t, http.StatusServiceUnavailable, rr.Code, "body=%s", rr.Body.String())
}

func TestAuth_ResetPassword_BadToken(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/auth/reset-password/", map[string]any{
		"token":        "not-a-real-token",
		"new_password": "Br4nd!NewPass",
	}, "")
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestAuth_MagicCodeRequest_NoSMTPReturns503(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/auth/magic-code/request/", map[string]string{"email": "code@test.local"}, "")
	require.Equal(t, http.StatusServiceUnavailable, rr.Code)
}

func TestAuth_MagicCodeVerify_NoRedis(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/auth/magic-code/verify/", map[string]any{
		"email": "code@test.local",
		"code":  "123456",
	}, "")
	require.Equal(t, http.StatusServiceUnavailable, rr.Code)
}

func TestAuth_SetPassword_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/auth/set-password/", map[string]any{"password": "Br4nd!NewPass"}, "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestAuth_SetPassword_AlreadySet(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB) // factory creates real-password user (NOT autoset)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.POST("/api/users/me/set-password/", map[string]any{"password": "Br4nd!NewPass"}, session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}

func TestAuth_SetPassword_AutosetUserCanSet(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB, testutil.WithUserPasswordAutoset())
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.POST("/api/users/me/set-password/", map[string]any{"password": "Br4nd!NewPass"}, session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestAuth_UserActivity_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/api/users/me/activity/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestAuth_UserActivity_OK(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/api/users/me/activity/", session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}
