package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PageHandler serves project / workspace pages and their content/version actions.
type PageHandler struct {
	Page *service.PageService
}

func (h *PageHandler) requireUser(c *gin.Context) (uuid.UUID, bool) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return uuid.Nil, false
	}
	return user.ID, true
}

func parsePageID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("pageId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid page ID"})
		return uuid.Nil, false
	}
	return id, true
}

// translatePageError maps service errors to HTTP responses. 404 hides the
// difference between "missing" and "no permission" to avoid existence leaks.
func translatePageError(c *gin.Context, err error, fallback string) {
	switch {
	case errors.Is(err, service.ErrPageNotFound),
		errors.Is(err, service.ErrProjectForbidden),
		errors.Is(err, service.ErrProjectNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, service.ErrPageReadOnly):
		c.JSON(http.StatusForbidden, gin.H{"error": "No permission to edit this page"})
	case errors.Is(err, service.ErrPageLocked):
		c.JSON(http.StatusConflict, gin.H{"error": "Page is locked"})
	case errors.Is(err, service.ErrPageArchived):
		c.JSON(http.StatusConflict, gin.H{"error": "Page is archived"})
	case errors.Is(err, service.ErrPageNotArchived):
		c.JSON(http.StatusConflict, gin.H{"error": "Page must be archived before deletion"})
	case errors.Is(err, service.ErrPageBadParent):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parent page"})
	case errors.Is(err, service.ErrPageBadRequest):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": fallback})
	}
}

// List returns pages.
// GET /api/workspaces/:slug/pages/?project_id&parent_id&archived=true|false&search&owned_by_me=true
func (h *PageHandler) List(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")

	var projectID *uuid.UUID
	if p := c.Query("project_id"); p != "" {
		if id, err := uuid.Parse(p); err == nil {
			projectID = &id
		}
	}

	opts := store.ListPagesOpts{}
	switch c.Query("archived") {
	case "true":
		t := true
		opts.Archived = &t
	case "false":
		f := false
		opts.Archived = &f
	}
	if p := c.Query("parent_id"); p != "" {
		if id, err := uuid.Parse(p); err == nil {
			opts.ParentID = &id
		}
	} else if c.Query("only_roots") == "true" {
		opts.OnlyRoots = true
	}
	if c.Query("owned_by_me") == "true" {
		opts.OwnerID = &userID
	}
	opts.Search = c.Query("search")

	list, err := h.Page.List(c.Request.Context(), slug, projectID, userID, opts)
	if err != nil {
		translatePageError(c, err, "Failed to list pages")
		return
	}
	c.JSON(http.StatusOK, list)
}

// ListChildren returns immediate sub-pages of a page.
// GET /api/workspaces/:slug/pages/:pageId/children/
func (h *PageHandler) ListChildren(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	list, err := h.Page.ListChildren(c.Request.Context(), slug, pageID, userID)
	if err != nil {
		translatePageError(c, err, "Failed to list sub-pages")
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a page.
// POST /api/workspaces/:slug/pages/
func (h *PageHandler) Create(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	var body struct {
		Name            string     `json:"name"`
		DescriptionHTML string     `json:"description_html"`
		ProjectID       *uuid.UUID `json:"project_id"`
		ParentID        *uuid.UUID `json:"parent_id"`
		Access          int16      `json:"access"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	page, err := h.Page.Create(c.Request.Context(), slug, body.ProjectID, userID, body.Name, body.DescriptionHTML, body.Access, body.ParentID)
	if err != nil {
		translatePageError(c, err, "Failed to create page")
		return
	}
	c.JSON(http.StatusCreated, page)
}

// Get returns a page.
// GET /api/workspaces/:slug/pages/:pageId/
func (h *PageHandler) Get(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	page, err := h.Page.Get(c.Request.Context(), slug, pageID, userID)
	if err != nil {
		translatePageError(c, err, "Failed to get page")
		return
	}
	c.JSON(http.StatusOK, page)
}

// UpdateMeta updates name / access / parent / logo. Owner-only.
// PATCH /api/workspaces/:slug/pages/:pageId/
//
// `logo_props` follows tri-state semantics: omitted = leave untouched;
// `null` = clear; object = replace. Gin's bind layer flattens missing fields
// to the zero value, so we use a `json.RawMessage` to disambiguate.
func (h *PageHandler) UpdateMeta(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	var body struct {
		Name        *string         `json:"name"`
		Access      *int16          `json:"access"`
		ParentID    *uuid.UUID      `json:"parent_id"`
		ClearParent bool            `json:"clear_parent"`
		LogoProps   json.RawMessage `json:"logo_props"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	in := service.PageMetaUpdate{
		Name:        body.Name,
		Access:      body.Access,
		ParentID:    body.ParentID,
		ClearParent: body.ClearParent,
	}
	if len(body.LogoProps) > 0 {
		in.SetLogoProps = true
		// Treat the JSON literal `null` as an explicit clear.
		if string(body.LogoProps) != "null" {
			var props model.JSONMap
			if err := json.Unmarshal(body.LogoProps, &props); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid logo_props", "detail": err.Error()})
				return
			}
			in.LogoProps = props
		}
	}
	page, err := h.Page.UpdateMeta(c.Request.Context(), slug, pageID, userID, in)
	if err != nil {
		translatePageError(c, err, "Failed to update page")
		return
	}
	c.JSON(http.StatusOK, page)
}

// UpdateContent autosaves the body HTML.
// PATCH /api/workspaces/:slug/pages/:pageId/content/
func (h *PageHandler) UpdateContent(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	// description_html is a *string + binding:"required" so an absent field
	// fails validation (returns 400) but an explicit empty string is allowed —
	// users may legitimately want to clear the body.
	var body struct {
		DescriptionHTML *string `json:"description_html" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	page, err := h.Page.UpdateContent(c.Request.Context(), slug, pageID, userID, *body.DescriptionHTML)
	if err != nil {
		translatePageError(c, err, "Failed to save")
		return
	}
	c.JSON(http.StatusOK, page)
}

// Lock / Unlock — owner-only.
// POST/DELETE /api/workspaces/:slug/pages/:pageId/lock/
func (h *PageHandler) Lock(c *gin.Context)   { h.lockToggle(c, true) }
func (h *PageHandler) Unlock(c *gin.Context) { h.lockToggle(c, false) }

func (h *PageHandler) lockToggle(c *gin.Context, lock bool) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	var err error
	if lock {
		err = h.Page.Lock(c.Request.Context(), slug, pageID, userID)
	} else {
		err = h.Page.Unlock(c.Request.Context(), slug, pageID, userID)
	}
	if err != nil {
		translatePageError(c, err, "Failed to update lock")
		return
	}
	c.Status(http.StatusNoContent)
}

// Archive / Unarchive — owner-only. Archive cascades to descendants.
// POST/DELETE /api/workspaces/:slug/pages/:pageId/archive/
func (h *PageHandler) Archive(c *gin.Context)   { h.archiveToggle(c, true) }
func (h *PageHandler) Unarchive(c *gin.Context) { h.archiveToggle(c, false) }

func (h *PageHandler) archiveToggle(c *gin.Context, archive bool) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	var err error
	if archive {
		err = h.Page.Archive(c.Request.Context(), slug, pageID, userID)
	} else {
		err = h.Page.Unarchive(c.Request.Context(), slug, pageID, userID)
	}
	if err != nil {
		translatePageError(c, err, "Failed to update archive")
		return
	}
	c.Status(http.StatusNoContent)
}

// Delete — owner-only, archived-only.
// DELETE /api/workspaces/:slug/pages/:pageId/
func (h *PageHandler) Delete(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	if err := h.Page.Delete(c.Request.Context(), slug, pageID, userID); err != nil {
		translatePageError(c, err, "Failed to delete page")
		return
	}
	c.Status(http.StatusNoContent)
}

// Duplicate — any viewer can duplicate; new page is owned by caller.
// POST /api/workspaces/:slug/pages/:pageId/duplicate/
func (h *PageHandler) Duplicate(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	page, err := h.Page.Duplicate(c.Request.Context(), slug, pageID, userID)
	if err != nil {
		translatePageError(c, err, "Failed to duplicate page")
		return
	}
	c.JSON(http.StatusCreated, page)
}

// ListVersions / GetVersion / RestoreVersion
// GET /api/workspaces/:slug/pages/:pageId/versions/
// GET /api/workspaces/:slug/pages/:pageId/versions/:versionId/
// POST /api/workspaces/:slug/pages/:pageId/versions/:versionId/restore/
func (h *PageHandler) ListVersions(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	list, err := h.Page.ListVersions(c.Request.Context(), slug, pageID, userID)
	if err != nil {
		translatePageError(c, err, "Failed to list versions")
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *PageHandler) GetVersion(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	versionID, err := uuid.Parse(c.Param("versionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version ID"})
		return
	}
	v, err := h.Page.GetVersion(c.Request.Context(), slug, pageID, versionID, userID)
	if err != nil {
		translatePageError(c, err, "Failed to get version")
		return
	}
	c.JSON(http.StatusOK, v)
}

func (h *PageHandler) RestoreVersion(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	versionID, err := uuid.Parse(c.Param("versionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version ID"})
		return
	}
	page, err := h.Page.RestoreVersion(c.Request.Context(), slug, pageID, versionID, userID)
	if err != nil {
		translatePageError(c, err, "Failed to restore version")
		return
	}
	c.JSON(http.StatusOK, page)
}

// AddFavorite / RemoveFavorite / ListFavorites
// POST/DELETE /api/workspaces/:slug/pages/:pageId/favorite/
// GET /api/workspaces/:slug/pages/favorites/
func (h *PageHandler) AddFavorite(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	if err := h.Page.AddFavorite(c.Request.Context(), slug, pageID, userID); err != nil {
		translatePageError(c, err, "Failed to favorite page")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *PageHandler) RemoveFavorite(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	pageID, ok := parsePageID(c)
	if !ok {
		return
	}
	if err := h.Page.RemoveFavorite(c.Request.Context(), slug, pageID, userID); err != nil {
		translatePageError(c, err, "Failed to unfavorite page")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *PageHandler) ListFavorites(c *gin.Context) {
	userID, ok := h.requireUser(c)
	if !ok {
		return
	}
	slug := c.Param("slug")
	ids, err := h.Page.ListFavoriteIDs(c.Request.Context(), slug, userID)
	if err != nil {
		translatePageError(c, err, "Failed to list favorites")
		return
	}
	c.JSON(http.StatusOK, ids)
}
