package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInstance_SetupStatus_FreshDB(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/api/instance/setup-status/", "")
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, true, body["setup_required"])
}

func TestInstance_SetupStatus_AfterSetup(t *testing.T) {
	ts := testutil.NewTestServer(t)
	// Seeding a user marks the instance as set up.
	testutil.CreateUser(t, ts.DB)

	rr := ts.GET("/api/instance/setup-status/", "")
	require.Equal(t, http.StatusOK, rr.Code)
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, false, body["setup_required"])
}

func TestInstance_Setup_Success(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/api/instance/setup/", map[string]any{
		"first_name":   "Ada",
		"last_name":    "Lovelace",
		"email":        "ada@test.local",
		"password":     "S3cur3!Pass",
		"company_name": "Analytical Engine Co.",
	}, "")
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())

	user := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "ada@test.local", user["email"])
	assert.NotEmpty(t, user["id"])

	// Setup-status should now report no setup needed.
	rr2 := ts.GET("/api/instance/setup-status/", "")
	require.Equal(t, http.StatusOK, rr2.Code)
	assert.Equal(t, false, testutil.MustJSONMap(t, rr2)["setup_required"])
}

func TestInstance_Setup_RejectsSecondCall(t *testing.T) {
	ts := testutil.NewTestServer(t)
	testutil.CreateUser(t, ts.DB)

	rr := ts.POST("/api/instance/setup/", map[string]any{
		"first_name": "Ada",
		"last_name":  "Lovelace",
		"email":      "ada2@test.local",
		"password":   "S3cur3!Pass",
	}, "")
	require.Equal(t, http.StatusForbidden, rr.Code)
}

func TestInstance_Setup_RejectsWeakPassword(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/api/instance/setup/", map[string]any{
		"first_name": "Ada",
		"last_name":  "Lovelace",
		"email":      "ada@test.local",
		"password":   "tooweak",
	}, "")
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestInstance_Settings_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/api/instance/settings/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestInstance_Settings_GetWithAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, user)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/api/instance/settings/", session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	body := testutil.MustJSONMap(t, rr)
	// Defaults are filled in for every section even on a fresh DB.
	for _, key := range []string{"general", "email", "auth", "oauth", "ai", "image", "github_app"} {
		assert.NotNil(t, body[key], "missing settings section %q", key)
	}
}

func TestInstance_Settings_NonAdminForbidden(t *testing.T) {
	ts := testutil.NewTestServer(t)
	admin := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, admin)
	// A different, non-admin authenticated user must not read instance settings.
	other := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, other)

	rr := ts.GET("/api/instance/settings/", session)
	require.Equal(t, http.StatusForbidden, rr.Code, "body=%s", rr.Body.String())

	rr2 := ts.PATCH("/api/instance/settings/email", map[string]any{
		"value": map[string]any{"host": "attacker.example.com"},
	}, session)
	require.Equal(t, http.StatusForbidden, rr2.Code, "body=%s", rr2.Body.String())
}

func TestInstance_Settings_SecretsReturnedToAdmin(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, user)
	session := testutil.LoginAs(t, ts.DB, user)

	// Store an SMTP password.
	rr := ts.PATCH("/api/instance/settings/email", map[string]any{
		"value": map[string]any{"host": "smtp.example.com", "password": "super-secret"},
	}, session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	// The admin GET returns the decrypted secret value.
	rr2 := ts.GET("/api/instance/settings/", session)
	require.Equal(t, http.StatusOK, rr2.Code)
	body := testutil.MustJSONMap(t, rr2)
	email, _ := body["email"].(map[string]any)
	require.NotNil(t, email)
	assert.Equal(t, "super-secret", email["password"])
}

func TestInstance_Admins_ListAddRemove(t *testing.T) {
	ts := testutil.NewTestServer(t)
	admin := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, admin)
	session := testutil.LoginAs(t, ts.DB, admin)

	// Initially exactly one admin.
	rr := ts.GET("/api/instance/admins/", session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	list := testutil.DecodeJSON[[]map[string]any](t, rr)
	require.Len(t, list, 1)

	// Add a second user as admin by email.
	other := testutil.CreateUser(t, ts.DB)
	rrAdd := ts.POST("/api/instance/admins/", map[string]any{"email": *other.Email}, session)
	require.Equal(t, http.StatusCreated, rrAdd.Code, "body=%s", rrAdd.Body.String())

	rr2 := ts.GET("/api/instance/admins/", session)
	require.Len(t, testutil.DecodeJSON[[]map[string]any](t, rr2), 2)

	// The newly added admin can now reach the gated settings.
	otherSession := testutil.LoginAs(t, ts.DB, other)
	require.Equal(t, http.StatusOK, ts.GET("/api/instance/settings/", otherSession).Code)

	// Remove the second admin.
	added := testutil.DecodeJSON[map[string]any](t, rrAdd)
	id, _ := added["id"].(string)
	require.NotEmpty(t, id)
	rrDel := ts.DELETE("/api/instance/admins/"+id+"/", session)
	require.Equal(t, http.StatusNoContent, rrDel.Code, "body=%s", rrDel.Body.String())

	// They lose access afterwards.
	require.Equal(t, http.StatusForbidden, ts.GET("/api/instance/settings/", otherSession).Code)
}

func TestInstance_Admins_AddRejectsInvalidRole(t *testing.T) {
	ts := testutil.NewTestServer(t)
	admin := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, admin)
	session := testutil.LoginAs(t, ts.DB, admin)
	other := testutil.CreateUser(t, ts.DB)

	// A non-admin role value (5 = guest) must be rejected, not coerced to Owner.
	rr := ts.POST("/api/instance/admins/", map[string]any{"email": *other.Email, "role": 5}, session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}

func TestInstance_Admins_NonAdminForbidden(t *testing.T) {
	ts := testutil.NewTestServer(t)
	admin := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, admin)
	other := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, other)

	require.Equal(t, http.StatusForbidden, ts.GET("/api/instance/admins/", session).Code)
	require.Equal(t, http.StatusForbidden, ts.POST("/api/instance/admins/", map[string]any{"email": *admin.Email}, session).Code)
}

func TestInstance_Admins_CannotRemoveLast(t *testing.T) {
	ts := testutil.NewTestServer(t)
	admin := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, admin)
	session := testutil.LoginAs(t, ts.DB, admin)

	row := testutil.DecodeJSON[[]map[string]any](t, ts.GET("/api/instance/admins/", session))
	require.Len(t, row, 1)
	id, _ := row[0]["id"].(string)
	require.NotEmpty(t, id)

	rr := ts.DELETE("/api/instance/admins/"+id+"/", session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}

func TestInstance_Setup_SeedsInstanceAdmin(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.POST("/api/instance/setup/", map[string]any{
		"first_name": "Ada", "last_name": "Lovelace",
		"email": "ada@test.local", "password": "S3cur3!Pass",
	}, "")
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())

	// The first user is now an instance admin and can reach the gated settings.
	var u model.User
	require.NoError(t, ts.DB.Where("email = ?", "ada@test.local").First(&u).Error)
	session := testutil.LoginAs(t, ts.DB, &u)
	require.Equal(t, http.StatusOK, ts.GET("/api/instance/settings/", session).Code)
}

func TestInstance_Settings_UpdateGeneral(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, user)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.PATCH("/api/instance/settings/general", map[string]any{
		"value": map[string]any{
			"instance_name":                   "Acme Inc.",
			"only_admin_can_create_workspace": true,
		},
	}, session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	out := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "general", out["key"])
	val, _ := out["value"].(map[string]any)
	require.NotNil(t, val)
	assert.Equal(t, "Acme Inc.", val["instance_name"])
	assert.Equal(t, true, val["only_admin_can_create_workspace"])
}

func TestInstance_Settings_UpdateInvalidKey(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, user)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.PATCH("/api/instance/settings/not-a-real-section", map[string]any{
		"value": map[string]any{},
	}, session)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestInstance_Unsplash_NotConfigured(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/api/instance/unsplash/search?q=cats", session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}
