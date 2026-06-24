package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/crypto"
	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Allowed instance setting section keys (must match migration seed).
var allowedSettingKeys = map[string]bool{
	"general": true, "email": true, "auth": true, "oauth": true, "ai": true, "image": true,
	"github_app": true,
}

// InstanceHandler serves instance setup (first-run); no auth required.
type InstanceHandler struct {
	Auth     *auth.Service
	Users    *store.UserStore
	Settings *store.InstanceSettingStore
	Admins   *store.InstanceAdminStore
}

// InstanceSettingsHandler serves instance settings (GET/PATCH) and instance-admin
// management; all endpoints require the caller to be an instance admin.
type InstanceSettingsHandler struct {
	Settings *store.InstanceSettingStore
	Admins   *store.InstanceAdminStore
	Users    *store.UserStore
	// OnSectionUpdated, if set, is invoked after a successful update with the
	// section key. Used for hot-reload of integration clients (e.g. github_app)
	// so the new credentials take effect without an API restart.
	OnSectionUpdated func(ctx context.Context, key string)
}

// SetupStatusResponse for GET /api/instance/setup-status/
type SetupStatusResponse struct {
	SetupRequired bool `json:"setup_required"`
}

// SetupStatus reports whether the instance requires initial setup.
// GET /api/instance/setup-status/
func (h *InstanceHandler) SetupStatus(c *gin.Context) {
	count, err := h.Users.Count(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check setup status"})
		return
	}
	c.JSON(http.StatusOK, SetupStatusResponse{SetupRequired: count == 0})
}

// InstanceSetupRequest for POST /api/instance/setup/
type InstanceSetupRequest struct {
	FirstName   string `json:"first_name" binding:"required"`
	LastName    string `json:"last_name" binding:"required"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	CompanyName string `json:"company_name"`
}

// InstanceSetup performs first-run setup (creates first user and session).
// POST /api/instance/setup/
func (h *InstanceHandler) InstanceSetup(c *gin.Context) {
	count, err := h.Users.Count(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Setup check failed"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Instance is already set up"})
		return
	}
	var req InstanceSetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	sessionKey, user, err := h.Auth.SignUp(c.Request.Context(), auth.SignUpRequest{
		Email:     req.Email,
		Password:  req.Password,
		FirstName: req.FirstName,
		LastName:  req.LastName,
	})
	if err != nil {
		if err == auth.ErrEmailTaken {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
			return
		}
		if err == auth.ErrUsernameTaken {
			c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sign up failed"})
		return
	}

	// Register the first user as an instance admin.
	if h.Admins != nil {
		_ = h.Admins.Create(c.Request.Context(), &model.InstanceAdmin{
			UserID:     user.ID,
			Role:       model.RoleOwner,
			IsVerified: true,
		})
	}

	// Seed general instance settings: generated instance_id, admin email from setup, instance name from company name
	if h.Settings != nil {
		instanceID := generateInstanceID()
		instanceName := strings.TrimSpace(req.CompanyName)
		if instanceName == "" {
			instanceName = user.DisplayName
		}
		_ = h.Settings.Upsert(c.Request.Context(), "general", model.JSONMap{
			"instance_id":                     instanceID,
			"admin_email":                     req.Email,
			"instance_name":                   instanceName,
			"only_admin_can_create_workspace": false,
		})
	}

	setSessionCookie(c, sessionKey)
	c.JSON(http.StatusCreated, userResponse(user))
}

// generateInstanceID returns a 24-character hex string for the instance.
func generateInstanceID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return hex.EncodeToString([]byte("default"))
	}
	return hex.EncodeToString(b)
}

// isInstanceAdmin reports whether the authenticated user is an instance admin,
// looked up in the instance_admins table by user id + role. Fails closed on any
// error.
func (h *InstanceSettingsHandler) isInstanceAdmin(c *gin.Context) bool {
	user := middleware.GetUser(c)
	if user == nil || h.Admins == nil {
		return false
	}
	ok, err := h.Admins.IsAdmin(c.Request.Context(), user.ID)
	return err == nil && ok
}

// requireInstanceAdmin writes a 403 and returns false if the caller is not an
// instance administrator.
func (h *InstanceSettingsHandler) requireInstanceAdmin(c *gin.Context) bool {
	if !h.isInstanceAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Instance admin access required"})
		return false
	}
	return true
}

// ListAdmins returns all instance admins. Admin-gated.
// GET /api/instance/admins/
func (h *InstanceSettingsHandler) ListAdmins(c *gin.Context) {
	if !h.requireInstanceAdmin(c) {
		return
	}
	admins, err := h.Admins.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load instance admins"})
		return
	}
	c.JSON(http.StatusOK, admins)
}

type addAdminRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  *int16 `json:"role"`
}

// AddAdmin grants instance-admin to an existing user by email. Admin-gated.
// POST /api/instance/admins/
func (h *InstanceSettingsHandler) AddAdmin(c *gin.Context) {
	if !h.requireInstanceAdmin(c) {
		return
	}
	if h.Users == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Not configured"})
		return
	}
	var req addAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	u, err := h.Users.GetByEmail(c.Request.Context(), strings.TrimSpace(strings.ToLower(req.Email)))
	if err != nil || u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No user with that email"})
		return
	}
	// Idempotent: if already an admin, return the existing row.
	if existing, err := h.Admins.GetByUserID(c.Request.Context(), u.ID); err == nil && existing != nil {
		c.JSON(http.StatusOK, existing)
		return
	}
	// Default to Owner when omitted; otherwise the role must be an explicit,
	// valid admin level — reject anything else rather than silently coercing it.
	role := model.RoleOwner
	if req.Role != nil {
		if *req.Role != model.RoleAdmin && *req.Role != model.RoleOwner {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
			return
		}
		role = *req.Role
	}
	admin := &model.InstanceAdmin{UserID: u.ID, Role: role, IsVerified: true}
	if err := h.Admins.Create(c.Request.Context(), admin); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add instance admin"})
		return
	}
	c.JSON(http.StatusCreated, admin)
}

// RemoveAdmin revokes instance-admin by row id. Admin-gated; refuses to remove
// the last remaining admin so the instance can't be locked out.
// DELETE /api/instance/admins/:id/
func (h *InstanceSettingsHandler) RemoveAdmin(c *gin.Context) {
	if !h.requireInstanceAdmin(c) {
		return
	}
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid admin id"})
		return
	}
	if err := h.Admins.DeleteByPKIfNotLast(c.Request.Context(), id); err != nil {
		if errors.Is(err, store.ErrLastInstanceAdmin) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove the last instance admin"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove instance admin"})
		return
	}
	c.Status(http.StatusNoContent)
}

// GetSettings returns all instance settings sections with secrets decrypted for
// the admin UI. Admin access is required — the gate is the protection, not
// masking.
// GET /api/instance/settings/
func (h *InstanceSettingsHandler) GetSettings(c *gin.Context) {
	if !h.requireInstanceAdmin(c) {
		return
	}
	all, err := h.Settings.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
		return
	}
	out := make(map[string]model.JSONMap)
	for k, row := range all {
		out[k] = decryptSectionSecretsInternal(k, row.Value)
	}
	// Ensure all sections exist with defaults (migration seed may not have run if DB was created before seed)
	for _, key := range []string{"general", "email", "auth", "oauth", "ai", "image", "github_app"} {
		if _, ok := out[key]; !ok {
			out[key] = defaultSettingValue(key)
		}
	}
	c.JSON(http.StatusOK, out)
}

// secretKeysBySection lists the encrypted secret fields stored in each settings section.
var secretKeysBySection = map[string][]string{
	"email":      {"password"},
	"oauth":      {"google_client_secret", "github_client_secret", "gitlab_client_secret"},
	"ai":         {"api_key"},
	"image":      {"unsplash_access_key"},
	"github_app": {"private_key", "client_secret", "webhook_secret"},
}

// decryptSectionSecretsInternal returns a copy of m with secret fields decrypted.
// Used both for the admin settings responses (admin-gated) and for server-side
// use (building OAuth providers, proxying Unsplash).
func decryptSectionSecretsInternal(sectionKey string, m model.JSONMap) model.JSONMap {
	if m == nil {
		return nil
	}
	out := make(model.JSONMap, len(m))
	for k, v := range m {
		out[k] = v
	}
	for _, sk := range secretKeysBySection[sectionKey] {
		if v, ok := out[sk].(string); ok {
			out[sk] = crypto.DecryptOrPlain(v)
		}
	}
	return out
}

func defaultSettingValue(key string) model.JSONMap {
	switch key {
	case "general":
		return model.JSONMap{"instance_name": "", "admin_email": "", "instance_id": "", "only_admin_can_create_workspace": false}
	case "email":
		return model.JSONMap{"host": "", "port": "587", "sender_email": "", "security": "TLS", "username": "", "password_set": false}
	case "auth":
		return model.JSONMap{"allow_public_signup": true, "magic_code": true, "password": true, "google": false, "github": false, "gitlab": false}
	case "oauth":
		return model.JSONMap{
			"google_client_id": "", "google_client_secret_set": false,
			"github_client_id": "", "github_client_secret_set": false,
			"gitlab_client_id": "", "gitlab_client_secret_set": false, "gitlab_host": "",
		}
	case "ai":
		return model.JSONMap{"model": "gpt-4o-mini", "api_key_set": false}
	case "image":
		return model.JSONMap{"unsplash_access_key_set": false}
	case "github_app":
		return model.JSONMap{
			"app_id": "", "app_name": "", "client_id": "",
			"client_secret_set": false, "private_key_set": false, "webhook_secret_set": false,
		}
	default:
		return model.JSONMap{}
	}
}

// UpdateSettingRequest for PATCH /api/instance/settings/:key
type UpdateSettingRequest struct {
	Value model.JSONMap `json:"value" binding:"required"`
}

// UpdateSetting updates one instance settings section by key.
// PATCH /api/instance/settings/:key
func (h *InstanceSettingsHandler) UpdateSetting(c *gin.Context) {
	if !h.requireInstanceAdmin(c) {
		return
	}
	key := strings.TrimSpace(strings.ToLower(c.Param("key")))
	if key == "" || !allowedSettingKeys[key] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid settings key"})
		return
	}
	var req UpdateSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	value := req.Value
	if key == "general" {
		// instance_name and only_admin_can_create_workspace are editable; preserve admin_email and instance_id
		existing, _ := h.Settings.Get(c.Request.Context(), "general")
		merged := model.JSONMap{}
		if existing != nil {
			for k, v := range existing.Value {
				merged[k] = v
			}
		}
		if name, ok := req.Value["instance_name"]; ok {
			merged["instance_name"] = name
		}
		if onlyAdmin, ok := req.Value["only_admin_can_create_workspace"]; ok {
			merged["only_admin_can_create_workspace"] = onlyAdmin
		}
		value = merged
	}
	if key == "email" {
		// Merge with existing; store password encrypted (preserve existing if not sent)
		existing, _ := h.Settings.Get(c.Request.Context(), "email")
		merged := model.JSONMap{}
		if existing != nil {
			for k, v := range existing.Value {
				merged[k] = v
			}
		}
		for k, v := range req.Value {
			if k == "password" {
				if s, ok := v.(string); ok && s != "" {
					merged["password"] = crypto.EncryptOrPlain(s)
					merged["password_set"] = true
				}
				continue
			}
			merged[k] = v
		}
		value = merged
	}
	if key == "ai" {
		// Store api_key encrypted (preserve existing if not sent)
		existing, _ := h.Settings.Get(c.Request.Context(), "ai")
		merged := model.JSONMap{}
		if existing != nil {
			for k, v := range existing.Value {
				merged[k] = v
			}
		}
		for k, v := range req.Value {
			if k == "api_key" {
				if s, ok := v.(string); ok && s != "" {
					merged["api_key"] = crypto.EncryptOrPlain(s)
					merged["api_key_set"] = true
				}
				continue
			}
			merged[k] = v
		}
		value = merged
	}
	if key == "image" {
		// Store unsplash_access_key encrypted (preserve existing if not sent)
		existing, _ := h.Settings.Get(c.Request.Context(), "image")
		merged := model.JSONMap{}
		if existing != nil {
			for k, v := range existing.Value {
				merged[k] = v
			}
		}
		for k, v := range req.Value {
			if k == "unsplash_access_key" {
				if s, ok := v.(string); ok && s != "" {
					merged["unsplash_access_key"] = crypto.EncryptOrPlain(s)
					merged["unsplash_access_key_set"] = true
				}
				continue
			}
			merged[k] = v
		}
		value = merged
	}
	if key == "auth" {
		// Merge with existing so per-provider pages (Google/GitHub/GitLab) do not wipe other flags.
		existing, _ := h.Settings.Get(c.Request.Context(), "auth")
		merged := model.JSONMap{}
		if existing != nil {
			for k, v := range existing.Value {
				merged[k] = v
			}
		} else {
			for k, v := range defaultSettingValue("auth") {
				merged[k] = v
			}
		}
		for k, v := range req.Value {
			merged[k] = v
		}
		value = merged
	}
	if key == "oauth" {
		existing, _ := h.Settings.Get(c.Request.Context(), "oauth")
		merged := model.JSONMap{}
		if existing != nil {
			for k, v := range existing.Value {
				merged[k] = v
			}
		}
		secretField := func(field string, setKey string) {
			if v, ok := req.Value[field]; ok {
				if s, ok := v.(string); ok && s != "" {
					merged[field] = crypto.EncryptOrPlain(s)
					merged[setKey] = true
				}
			}
		}
		for k, v := range req.Value {
			switch k {
			case "google_client_secret", "github_client_secret", "gitlab_client_secret":
				continue
			default:
				merged[k] = v
			}
		}
		secretField("google_client_secret", "google_client_secret_set")
		secretField("github_client_secret", "github_client_secret_set")
		secretField("gitlab_client_secret", "gitlab_client_secret_set")
		value = merged
	}
	if key == "github_app" {
		// Merge with existing; encrypt secrets and set *_set flags. Empty
		// strings are ignored so the admin can edit one field without resetting
		// the others.
		existing, _ := h.Settings.Get(c.Request.Context(), "github_app")
		merged := model.JSONMap{}
		if existing != nil {
			for k, v := range existing.Value {
				merged[k] = v
			}
		} else {
			for k, v := range defaultSettingValue("github_app") {
				merged[k] = v
			}
		}
		// Plain (non-secret) fields.
		for _, field := range []string{"app_id", "app_name", "client_id"} {
			if v, ok := req.Value[field]; ok {
				merged[field] = v
			}
		}
		// Secret fields: encrypt, set the *_set flag, never expose back.
		setSecret := func(field, setKey string) {
			if v, ok := req.Value[field]; ok {
				if s, ok := v.(string); ok && s != "" {
					merged[field] = crypto.EncryptOrPlain(s)
					merged[setKey] = true
				}
			}
		}
		setSecret("client_secret", "client_secret_set")
		setSecret("private_key", "private_key_set")
		setSecret("webhook_secret", "webhook_secret_set")
		value = merged
	}
	if err := h.Settings.Upsert(c.Request.Context(), key, value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
		return
	}
	// Hot-reload integrations (e.g. github_app) so the new credentials take
	// effect without an API restart. Errors here are logged-and-ignored — the
	// settings are already saved; a stale client is preferable to a 500.
	if h.OnSectionUpdated != nil {
		h.OnSectionUpdated(c.Request.Context(), key)
	}
	// Return decrypted secrets so the admin UI reflects the saved value.
	responseValue := decryptSectionSecretsInternal(key, value)
	c.JSON(http.StatusOK, gin.H{"key": key, "value": responseValue})
}

// unsplashPhoto is a single photo from Unsplash API response.
type unsplashPhoto struct {
	ID   string `json:"id"`
	URLs struct {
		Full    string `json:"full"`
		Regular string `json:"regular"`
		Thumb   string `json:"thumb"`
	} `json:"urls"`
}

// unsplashSearchResponse is the Unsplash search API response.
type unsplashSearchResponse struct {
	Results []unsplashPhoto `json:"results"`
}

// UnsplashSearchResult is a simplified photo returned by our proxy.
type UnsplashSearchResult struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	Thumb string `json:"thumb"`
}

// UnsplashSearch proxies search to Unsplash API using instance image settings key (auth required).
// GET /api/instance/unsplash/search?q=...
func (h *InstanceSettingsHandler) UnsplashSearch(c *gin.Context) {
	if h.Settings == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings not available"})
		return
	}
	row, err := h.Settings.Get(c.Request.Context(), "image")
	if err != nil || row == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsplash is not configured"})
		return
	}
	decrypted := decryptSectionSecretsInternal("image", row.Value)
	keyVal, _ := decrypted["unsplash_access_key"].(string)
	keyVal = strings.TrimSpace(keyVal)
	if keyVal == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsplash is not configured"})
		return
	}

	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusOK, gin.H{"results": []UnsplashSearchResult{}})
		return
	}

	apiURL := "https://api.unsplash.com/search/photos?query=" + url.QueryEscape(q) + "&per_page=20"
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, apiURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search"})
		return
	}
	req.Header.Set("Authorization", "Client-ID "+keyVal)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Unsplash search failed"})
		return
	}

	var payload unsplashSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid response"})
		return
	}

	results := make([]UnsplashSearchResult, 0, len(payload.Results))
	for _, p := range payload.Results {
		u := p.URLs.Regular
		if u == "" {
			u = p.URLs.Full
		}
		results = append(results, UnsplashSearchResult{ID: p.ID, URL: u, Thumb: p.URLs.Thumb})
	}
	c.JSON(http.StatusOK, gin.H{"results": results})
}
