package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Devlaner/devlane/api/internal/crypto"
	"github.com/Devlaner/devlane/api/internal/github"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/oauth"
	"github.com/Devlaner/devlane/api/internal/slack"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrIntegrationNotFound         = errors.New("integration not found")
	ErrIntegrationAlreadyInstalled = errors.New("integration already installed in this workspace")
	ErrGitHubAppNotConfigured      = errors.New("github app is not configured")
	ErrInstallationFetch           = errors.New("failed to fetch github installation")
	ErrInstallationAlreadyLinked   = errors.New("github installation is already linked to another workspace")
)

// IntegrationService coordinates the generic Integration / WorkspaceIntegration
// tables. GitHub-specific install logic lives here because GitHub is currently
// the only provider, but the structure allows other providers to slot in.
type IntegrationService struct {
	is  *store.IntegrationStore
	wis *store.WorkspaceIntegrationStore
	ws  *store.WorkspaceStore
	set *store.InstanceSettingStore
	sls *store.SlackChannelLinkStore

	githubClient *github.Client
}

// NewIntegrationService builds the service. githubClient may be nil — methods
// that need it will return ErrGitHubAppNotConfigured.
func NewIntegrationService(
	is *store.IntegrationStore,
	wis *store.WorkspaceIntegrationStore,
	ws *store.WorkspaceStore,
	set *store.InstanceSettingStore,
	sls *store.SlackChannelLinkStore,
	githubClient *github.Client,
) *IntegrationService {
	return &IntegrationService{is: is, wis: wis, ws: ws, set: set, githubClient: githubClient, sls: sls}
}

// SetGitHubClient replaces the cached client (called when admin updates
// github_app settings — we rebuild the AppAuth on every change).
func (s *IntegrationService) SetGitHubClient(c *github.Client) { s.githubClient = c }

// GitHubClient exposes the cached client (used by webhook handler).
func (s *IntegrationService) GitHubClient() *github.Client { return s.githubClient }

// ReloadGitHubClient re-reads the github_app instance settings and rebuilds
// the App auth + HTTP client. Returns nil when the section is empty (the
// client is reset to nil so endpoints return ErrGitHubAppNotConfigured).
//
// Called by the instance-admin handler whenever the admin saves the
// github_app section, so the new credentials take effect without an API
// restart.
func (s *IntegrationService) ReloadGitHubClient(ctx context.Context) error {
	app, err := LoadGitHubAppFromSettings(ctx, s.set)
	if err != nil {
		return err
	}
	if app == nil {
		s.githubClient = nil
		return nil
	}
	s.githubClient = github.NewClient(app, nil)
	return nil
}

// ListAvailable returns all registered providers (for the "available
// integrations" gallery).
func (s *IntegrationService) ListAvailable(ctx context.Context) ([]model.Integration, error) {
	return s.is.List(ctx)
}

// ListInstalled returns the workspace's installed integrations.
func (s *IntegrationService) ListInstalled(ctx context.Context, workspaceSlug string, userID uuid.UUID) ([]model.WorkspaceIntegration, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, ErrWorkspaceForbidden
	}
	return s.wis.ListByWorkspaceID(ctx, w.ID)
}

// GetByProvider returns the workspace's installed integration for the given
// provider, or ErrIntegrationNotFound. Verifies workspace membership.
func (s *IntegrationService) GetByProvider(ctx context.Context, workspaceSlug, provider string, userID uuid.UUID) (*model.WorkspaceIntegration, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, ErrWorkspaceForbidden
	}
	wi, err := s.wis.GetByWorkspaceAndProvider(ctx, w.ID, provider)
	if err != nil {
		return nil, ErrIntegrationNotFound
	}
	return wi, nil
}

func (s *IntegrationService) InstallSlack(ctx context.Context, workspaceSlug string, userID uuid.UUID, tokenData *oauth.TokenData) (*model.WorkspaceIntegration, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}

	m, err := s.ws.GetMember(ctx, w.ID, userID)
	if err != nil || m == nil || m.Role < model.RoleAdmin {
		return nil, ErrWorkspaceForbidden
	}

	slk, err := s.is.GetByProvider(ctx, "slack")
	if err != nil {
		return nil, ErrIntegrationNotFound
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://slack.com/api/auth.test", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create auth request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+tokenData.AccessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to verify slack token: %w", err)
	}
	defer resp.Body.Close()

	var authResult struct {
		Ok     bool   `json:"ok"`
		TeamID string `json:"team_id"`
		Team   string `json:"team"`
		Error  string `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&authResult); err != nil {
		return nil, fmt.Errorf("failed to parse auth response: %w", err)
	}

	if !authResult.Ok {
		return nil, fmt.Errorf("slack token verification failed: %s", authResult.Error)
	}

	// Encrypt the token for safe storage
	encryptedToken, err := crypto.Encrypt(tokenData.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt token: %w", err)
	}

	// Upsert the WorkspaceIntegration
	wi, err := s.wis.GetByWorkspaceAndProvider(ctx, w.ID, "slack")
	if err != nil {
		wi = &model.WorkspaceIntegration{
			WorkspaceID:   w.ID,
			IntegrationID: slk.ID,
			ActorID:       userID,
			AccountLogin:  authResult.Team,
			Config: model.JSONMap{
				"bot_token": encryptedToken,
				"team_id":   authResult.TeamID,
			},
		}
		if createErr := s.wis.Create(ctx, wi); createErr != nil {
			// There may be a soft-deleted row blocking the unique constraint.
			// Try to revive it instead.
			revived, reviveErr := s.wis.ReviveByWorkspaceAndIntegration(ctx, w.ID, slk.ID)
			if reviveErr != nil || revived == nil {
				return nil, fmt.Errorf("failed to save slack integration: %w", createErr)
			}
			wi = revived
			// Fall through to update the revived row below.
		} else {
			return wi, nil
		}
	}

	// Already exists (or just revived), update the token, name, and actor
	if wi.Config == nil {
		wi.Config = make(model.JSONMap)
	}
	wi.Config["bot_token"] = encryptedToken
	wi.Config["team_id"] = authResult.TeamID
	wi.AccountLogin = authResult.Team
	wi.ActorID = userID

	if err := s.wis.Update(ctx, wi); err != nil {
		return nil, fmt.Errorf("failed to update slack integration: %w", err)
	}

	return wi, nil
}

func (s *IntegrationService) SlackListChannels(ctx context.Context, workspaceSlug string, userID uuid.UUID) ([]slack.Channel, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}

	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, ErrWorkspaceForbidden
	}

	wi, err := s.wis.GetByWorkspaceAndProvider(ctx, w.ID, "slack")
	if err != nil {
		return nil, ErrIntegrationNotFound
	}

	rawToken, ok := wi.Config["bot_token"].(string)
	if !ok || rawToken == "" {
		return nil, errors.New("slack bot token is missing or invalid")
	}

	token := crypto.DecryptOrPlain(rawToken)
	slackClient := slack.NewClient(token)

	return slackClient.ListChannels(ctx)
}

func (s *IntegrationService) SlackLinkChannel(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, channelID, channelName string) (*model.SlackChannelLink, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	m, err := s.ws.GetMember(ctx, w.ID, userID)
	if err != nil || m == nil || m.Role < model.RoleAdmin {
		return nil, ErrWorkspaceForbidden
	}
	wi, err := s.wis.GetByWorkspaceAndProvider(ctx, w.ID, "slack")
	if err != nil {
		return nil, ErrIntegrationNotFound
	}

	link := &model.SlackChannelLink{
		WorkspaceIntegrationID: wi.ID,
		ProjectID:              projectID,
		WorkspaceID:            w.ID,
		ChannelID:              channelID,
		ChannelName:            channelName,
		ActorID:                userID,
		Events:                 model.JSONMap{"created": true, "state_changed": true, "commented": true},
	}

	// Ensure we only have one active channel per project
	_ = s.sls.SoftDelete(ctx, projectID)

	if err := s.sls.Create(ctx, link); err != nil {
		return nil, err
	}
	return link, nil
}

func (s *IntegrationService) SlackGetChannel(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) (*model.SlackChannelLink, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, ErrWorkspaceForbidden
	}
	return s.sls.GetByProject(ctx, projectID)
}

func (s *IntegrationService) SlackUpdateChannel(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, events model.JSONMap) (*model.SlackChannelLink, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	m, err := s.ws.GetMember(ctx, w.ID, userID)
	if err != nil || m == nil || m.Role < model.RoleAdmin {
		return nil, ErrWorkspaceForbidden
	}

	link, err := s.sls.GetByProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	link.Events = events
	link.ActorID = userID

	if err := s.sls.Update(ctx, link); err != nil {
		return nil, err
	}
	return link, nil
}

func (s *IntegrationService) SlackUnlinkChannel(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) error {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return ErrWorkspaceNotFound
	}
	m, err := s.ws.GetMember(ctx, w.ID, userID)
	if err != nil || m == nil || m.Role < model.RoleAdmin {
		return ErrWorkspaceForbidden
	}
	return s.sls.SoftDelete(ctx, projectID)
}

// InstallGitHub creates (or updates) a workspace_integrations row for a fresh
// GitHub App installation. Called from the App callback after the user
// completes the install flow on github.com.
//
// installationID is the value GitHub redirected back with as ?installation_id=
// — we trust it because the user's session ties it to a workspace via OAuth state.
func (s *IntegrationService) InstallGitHub(ctx context.Context, workspaceSlug string, userID uuid.UUID, installationID int64) (*model.WorkspaceIntegration, error) {
	if installationID <= 0 {
		return nil, errors.New("installation id is required")
	}
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	// Linking a GitHub App installation grants the workspace access to the
	// installation's repos — restrict it to workspace admins.
	if m, err := s.ws.GetMember(ctx, w.ID, userID); err != nil || m == nil || m.Role < model.RoleAdmin {
		return nil, ErrWorkspaceForbidden
	}
	gh, err := s.is.GetByProvider(ctx, "github")
	if err != nil {
		return nil, ErrIntegrationNotFound
	}

	// Verify the installation by fetching its metadata (owner, repos...).
	if s.githubClient == nil {
		return nil, ErrGitHubAppNotConfigured
	}
	account, err := s.fetchInstallationAccount(ctx, installationID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInstallationFetch, err)
	}

	// One installation may only map to one workspace. If a row already exists for
	// this installation in another workspace, re-point it (the latest installer wins).
	if existing, err := s.wis.GetByInstallationID(ctx, installationID); err == nil && existing != nil {
		if existing.WorkspaceID == w.ID {
			// Same workspace — refresh metadata and return.
			existing.AccountLogin = account.Login
			existing.AccountType = account.Type
			existing.AccountAvatarURL = account.AvatarURL
			existing.SuspendedAt = nil
			existing.UpdatedByID = &userID
			if existing.Metadata == nil {
				existing.Metadata = model.JSONMap{}
			}
			existing.Metadata["account_id"] = account.ID
			if err := s.wis.Update(ctx, existing); err != nil {
				return nil, err
			}
			existing.Provider = "github"
			return existing, nil
		}
		// Bound to a different workspace already. Refuse — otherwise any admin who
		// guesses/enumerates an installation_id could steal another org's
		// installation (and the private-repo access it carries) into their own
		// workspace. The rightful owner must uninstall first.
		return nil, ErrInstallationAlreadyLinked
	}

	// New installation in this workspace — error if the workspace already has
	// a different GitHub installation (one per workspace).
	if existing, err := s.wis.GetByWorkspaceAndProvider(ctx, w.ID, "github"); err == nil && existing != nil {
		// Re-point the existing row to the new installation_id.
		existing.InstallationID = &installationID
		existing.AccountLogin = account.Login
		existing.AccountType = account.Type
		existing.AccountAvatarURL = account.AvatarURL
		existing.SuspendedAt = nil
		existing.UpdatedByID = &userID
		if existing.Metadata == nil {
			existing.Metadata = model.JSONMap{}
		}
		existing.Metadata["account_id"] = account.ID
		if err := s.wis.Update(ctx, existing); err != nil {
			return nil, err
		}
		existing.Provider = "github"
		return existing, nil
	}

	wi := &model.WorkspaceIntegration{
		WorkspaceID:      w.ID,
		ActorID:          userID,
		IntegrationID:    gh.ID,
		InstallationID:   &installationID,
		AccountLogin:     account.Login,
		AccountType:      account.Type,
		AccountAvatarURL: account.AvatarURL,
		Metadata:         model.JSONMap{"account_id": account.ID},
		Config:           model.JSONMap{},
		CreatedByID:      &userID,
	}
	if err := s.wis.Create(ctx, wi); err != nil {
		return nil, err
	}
	wi.Provider = "github"
	return wi, nil
}

// Uninstall removes a workspace_integrations row by provider. The owning
// GitHub App installation is NOT auto-removed from github.com — the admin must
// remove it there too if they want the App fully revoked.
func (s *IntegrationService) Uninstall(ctx context.Context, workspaceSlug, provider string, userID uuid.UUID) error {
	wi, err := s.GetByProvider(ctx, workspaceSlug, provider, userID)
	if err != nil {
		return err
	}
	// Disconnecting a workspace integration is admin-only.
	if m, err := s.ws.GetMember(ctx, wi.WorkspaceID, userID); err != nil || m == nil || m.Role < model.RoleAdmin {
		return ErrWorkspaceForbidden
	}
	if provider == "github" && s.githubClient != nil && wi.InstallationID != nil {
		s.githubClient.InvalidateInstallation(*wi.InstallationID)
	}
	return s.wis.Delete(ctx, wi.ID)
}

// fetchInstallationAccount calls GET /app/installations/:id to get the account
// the App is installed for (org or user). Returns the embedded AccountLite so
// the caller can hydrate workspace_integrations.account_* fields.
func (s *IntegrationService) fetchInstallationAccount(ctx context.Context, installationID int64) (github.AccountLite, error) {
	inst, err := s.githubClient.GetInstallation(ctx, installationID)
	if err != nil {
		return github.AccountLite{}, err
	}
	return inst.Account, nil
}

// LoadGitHubAppFromSettings builds a github.AppAuth + github.Client from the
// `github_app` instance_settings section. Returns nil, nil when the section is
// not configured (so the integration UI can show a helpful "configure first"
// message rather than crashing).
func LoadGitHubAppFromSettings(ctx context.Context, set *store.InstanceSettingStore) (*github.AppAuth, error) {
	if set == nil {
		return nil, nil
	}
	row, err := set.Get(ctx, "github_app")
	if err != nil || row == nil {
		return nil, nil
	}
	v := row.Value
	appIDStr, _ := v["app_id"].(string)
	appIDStr = strings.TrimSpace(appIDStr)
	if appIDStr == "" {
		return nil, nil
	}
	appID, err := strconv.ParseInt(appIDStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("github_app.app_id must be a number: %w", err)
	}
	pkEnc, _ := v["private_key"].(string)
	if pkEnc == "" {
		return nil, nil
	}
	pk := crypto.DecryptOrPlain(pkEnc)
	if pk == "" {
		return nil, errors.New("github_app.private_key is set but could not be decrypted (check INSTANCE_ENCRYPTION_KEY)")
	}
	return github.NewAppAuth(appID, pk)
}

// LoadGitHubWebhookSecretFromSettings returns the decrypted webhook secret, or
// "" when not configured.
func LoadGitHubWebhookSecretFromSettings(ctx context.Context, set *store.InstanceSettingStore) string {
	if set == nil {
		return ""
	}
	row, err := set.Get(ctx, "github_app")
	if err != nil || row == nil {
		return ""
	}
	v, _ := row.Value["webhook_secret"].(string)
	if v == "" {
		return ""
	}
	return crypto.DecryptOrPlain(v)
}

// LoadGitHubAppNameFromSettings returns the App slug used to build the
// installation URL (https://github.com/apps/<slug>/installations/new).
func LoadGitHubAppNameFromSettings(ctx context.Context, set *store.InstanceSettingStore) string {
	if set == nil {
		return ""
	}
	row, err := set.Get(ctx, "github_app")
	if err != nil || row == nil {
		return ""
	}
	s, _ := row.Value["app_name"].(string)
	return strings.TrimSpace(s)
}
