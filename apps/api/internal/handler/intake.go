package handler

import (
	"net/http"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// IntakeHandler serves the project intake (triage inbox) endpoints.
type IntakeHandler struct {
	Intake *service.IntakeService
}

// statusFilter maps the ?status= query value to intake status codes. An empty
// or unknown value means "all statuses".
func statusFilter(v string) []int {
	switch v {
	case "pending":
		return []int{model.IntakeStatusPending}
	case "snoozed":
		return []int{model.IntakeStatusSnoozed}
	case "accepted":
		return []int{model.IntakeStatusAccepted}
	case "declined":
		return []int{model.IntakeStatusDeclined}
	case "duplicate":
		return []int{model.IntakeStatusDuplicate}
	default:
		return nil
	}
}

// List returns the project's intake items, optionally filtered by ?status=.
// GET /api/workspaces/:slug/projects/:projectId/intake-issues/
func (h *IntakeHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	pid, ok := projectID(c)
	if !ok {
		return
	}
	items, err := h.Intake.List(c.Request.Context(), c.Param("slug"), pid, user.ID, statusFilter(c.Query("status")))
	if err != nil {
		h.intakeError(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

// Count returns the pending-triage count for the sidebar badge.
// GET /api/workspaces/:slug/projects/:projectId/intake-issues/count/
func (h *IntakeHandler) Count(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	pid, ok := projectID(c)
	if !ok {
		return
	}
	n, err := h.Intake.PendingCount(c.Request.Context(), c.Param("slug"), pid, user.ID)
	if err != nil {
		h.intakeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"pending": n})
}

// Transition applies a triage action to an intake item.
// PATCH /api/workspaces/:slug/projects/:projectId/intake-issues/:pk/
func (h *IntakeHandler) Transition(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	pid, ok := projectID(c)
	if !ok {
		return
	}
	itemID, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid intake item ID"})
		return
	}
	var body struct {
		Action        string     `json:"action" binding:"required"`
		SnoozedTill   *time.Time `json:"snoozed_till"`
		DuplicateToID *string    `json:"duplicate_to_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	ctx := c.Request.Context()
	slug := c.Param("slug")
	switch body.Action {
	case "accept":
		err = h.Intake.Accept(ctx, slug, pid, itemID, user.ID)
	case "decline":
		err = h.Intake.Decline(ctx, slug, pid, itemID, user.ID)
	case "snooze":
		if body.SnoozedTill == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": service.ErrIntakeNeedSnooze.Error()})
			return
		}
		err = h.Intake.Snooze(ctx, slug, pid, itemID, user.ID, *body.SnoozedTill)
	case "duplicate":
		if body.DuplicateToID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": service.ErrIntakeNeedDup.Error()})
			return
		}
		dupID, perr := uuid.Parse(*body.DuplicateToID)
		if perr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid duplicate_to_id"})
			return
		}
		err = h.Intake.MarkDuplicate(ctx, slug, pid, itemID, user.ID, dupID)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown action"})
		return
	}
	if err != nil {
		h.intakeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *IntakeHandler) intakeError(c *gin.Context, err error) {
	switch err {
	case service.ErrProjectForbidden, service.ErrProjectNotFound, service.ErrIntakeNotFound:
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case service.ErrIntakeNeedSnooze, service.ErrIntakeNeedDup, service.ErrIntakeBadDuplicate:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Intake request failed"})
	}
}
