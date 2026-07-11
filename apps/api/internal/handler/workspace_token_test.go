package handler_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Workspace admins can mint, list, and revoke workspace-scoped service tokens;
// the secret is shown once, tokens are tagged with the workspace, and non-admins
// are refused. Covers #201.
func TestWorkspace_ServiceTokens(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	tokensURL := "/api/workspaces/" + w.Workspace.Slug + "/tokens/"

	// Admin mints a token; the plain secret is returned once.
	rr := ts.POST(tokensURL, map[string]any{"label": "CI deploy", "expires_in": "30d"}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	var created struct {
		Token string `json:"token"`
		Label string `json:"label"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &created))
	require.NotEmpty(t, created.Token, "the secret should be returned on create")
	require.Equal(t, "CI deploy", created.Label)

	// It lists without the secret.
	var listResp struct {
		Tokens []struct {
			ID       string `json:"id"`
			Label    string `json:"label"`
			IsActive bool   `json:"is_active"`
		} `json:"tokens"`
	}
	lr := ts.GET(tokensURL, w.Session)
	require.Equal(t, http.StatusOK, lr.Code)
	require.NoError(t, json.Unmarshal(lr.Body.Bytes(), &listResp))
	require.Len(t, listResp.Tokens, 1)
	require.Equal(t, "CI deploy", listResp.Tokens[0].Label)
	require.True(t, listResp.Tokens[0].IsActive)
	tokenID := listResp.Tokens[0].ID

	// It is tagged with the workspace in the DB.
	var dbToken model.ApiToken
	require.NoError(t, ts.DB.First(&dbToken, "id = ?", tokenID).Error)
	require.NotNil(t, dbToken.WorkspaceID)
	require.Equal(t, w.Workspace.ID, *dbToken.WorkspaceID)

	// A plain workspace member (not an admin) is refused.
	member := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.Workspace.ID, member.ID, model.RoleMember)
	memberSession := testutil.LoginAs(t, ts.DB, member)
	require.Equal(t, http.StatusForbidden, ts.GET(tokensURL, memberSession).Code)
	require.Equal(t, http.StatusForbidden,
		ts.POST(tokensURL, map[string]any{"label": "nope"}, memberSession).Code)

	// Revoke, and the list is empty again.
	require.Equal(t, http.StatusNoContent, ts.DELETE(tokensURL+tokenID+"/", w.Session).Code)
	lr2 := ts.GET(tokensURL, w.Session)
	var after struct {
		Tokens []json.RawMessage `json:"tokens"`
	}
	require.NoError(t, json.Unmarshal(lr2.Body.Bytes(), &after))
	require.Empty(t, after.Tokens)

	// Revoking a token that no longer exists is a 404 (not a 5xx).
	require.Equal(t, http.StatusNotFound, ts.DELETE(tokensURL+tokenID+"/", w.Session).Code)
}
