package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/crypto"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
)

// Allowed instance setting section keys (must match migration seed).
var allowedSettingKeys = map[string]bool{
	"general": true, "email": true, "auth": true, "ai": true, "image": true,
}

// InstanceHandler serves instance setup (first-run); no auth required.
type InstanceHandler struct {
	Auth     *auth.Service
	Users    *store.UserStore
	Settings *store.InstanceSettingStore
}

// InstanceSettingsHandler serves instance settings (GET/PATCH); requires auth.
type InstanceSettingsHandler struct {
	Settings *store.InstanceSettingStore
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

	// Seed general instance settings: generated instance_id, admin email from setup, instance name from company name
	if h.Settings != nil {
		instanceID := generateInstanceID()
		instanceName := strings.TrimSpace(req.CompanyName)
		if instanceName == "" {
			instanceName = user.DisplayName
		}
		_ = h.Settings.Upsert(c.Request.Context(), "general", model.JSONMap{
			"instance_id":                      instanceID,
			"admin_email":                      req.Email,
			"instance_name":                    instanceName,
			"only_admin_can_create_workspace":  false,
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

// GetSettings returns all instance settings sections; secrets are decrypted for admin UI.
// GET /api/instance/settings/
func (h *InstanceSettingsHandler) GetSettings(c *gin.Context) {
	all, err := h.Settings.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
		return
	}
	out := make(map[string]model.JSONMap)
	for k, row := range all {
		out[k] = decryptSectionSecrets(k, row.Value)
	}
	// Ensure all sections exist with defaults (migration seed may not have run if DB was created before seed)
	for _, key := range []string{"general", "email", "auth", "ai", "image"} {
		if _, ok := out[key]; !ok {
			out[key] = defaultSettingValue(key)
		}
	}
	c.JSON(http.StatusOK, out)
}

// decryptSectionSecrets returns a copy of m with secret keys decrypted for response.
func decryptSectionSecrets(sectionKey string, m model.JSONMap) model.JSONMap {
	if m == nil {
		return nil
	}
	var secretKeys []string
	switch sectionKey {
	case "email":
		secretKeys = []string{"password"}
	case "ai":
		secretKeys = []string{"api_key"}
	case "image":
		secretKeys = []string{"unsplash_access_key"}
	default:
		return m
	}
	out := make(model.JSONMap)
	for k, v := range m {
		out[k] = v
	}
	for _, sk := range secretKeys {
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
	case "ai":
		return model.JSONMap{"model": "gpt-4o-mini", "api_key_set": false}
	case "image":
		return model.JSONMap{"unsplash_access_key_set": false}
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
	if err := h.Settings.Upsert(c.Request.Context(), key, value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
		return
	}
	// Return decrypted secrets so client sees the value they just set
	responseValue := decryptSectionSecrets(key, value)
	c.JSON(http.StatusOK, gin.H{"key": key, "value": responseValue})
}
