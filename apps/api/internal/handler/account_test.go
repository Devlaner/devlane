package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Deactivating the current account returns 204, evicts the session (a follow-up
// authenticated request is rejected), and flips is_active off. Covers #209.
func TestAuth_DeactivateMe(t *testing.T) {
	ts := testutil.NewTestServer(t)
	u := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, u)

	rr := ts.POST("/api/users/me/deactivate/", nil, session)
	require.Equal(t, http.StatusNoContent, rr.Code, "body=%s", rr.Body.String())

	// The session was evicted, so the next authenticated call is unauthorized.
	rr2 := ts.GET("/api/users/me/", session)
	require.Equal(t, http.StatusUnauthorized, rr2.Code)

	got, err := store.NewUserStore(ts.DB).GetByID(context.Background(), u.ID)
	require.NoError(t, err)
	require.False(t, got.IsActive)
}

// Requesting an email change with no SMTP configured returns 503 (email infra
// is required to deliver the code).
func TestAuth_RequestEmailChange_RequiresSMTP(t *testing.T) {
	ts := testutil.NewTestServer(t)
	u := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, u)

	rr := ts.POST("/api/users/me/change-email/", map[string]any{"new_email": "new@example.com"}, session)
	require.Equal(t, http.StatusServiceUnavailable, rr.Code, "body=%s", rr.Body.String())
}
