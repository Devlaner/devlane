package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
)

// enforceProjectVisibility rejects access to a project whose visibility
// (`network`) is not public, unless the caller is a workspace admin/owner or a
// member of the project itself. Public projects are visible to any workspace
// member.
//
// It mirrors the gate in ProjectService.GetByID so that project sub-resources
// (issues, states, labels, cycles, modules, estimates, intake, comments, pages,
// views, attachments, …) respect the same rules — otherwise a plain workspace
// member could reach a secret project's data through its sub-resource routes
// even though the project itself returns 404.
//
// It returns ErrProjectNotFound when the project is hidden from the caller, to
// match GetByID's 404 behaviour and avoid leaking the project's existence.
// Callers should invoke it only after they have already confirmed workspace
// membership and that the project belongs to the workspace.
func enforceProjectVisibility(
	ctx context.Context,
	ps *store.ProjectStore,
	ws *store.WorkspaceStore,
	workspaceID, projectID, userID uuid.UUID,
) error {
	p, err := ps.GetByID(ctx, projectID)
	if err != nil {
		return ErrProjectNotFound
	}
	if p.Network == model.NetworkPublic {
		return nil
	}
	// Secret project: workspace admins/owners can always see it.
	if wm, err := ws.GetMember(ctx, workspaceID, userID); err == nil && wm != nil && wm.Role >= model.RoleAdmin {
		return nil
	}
	// Otherwise the caller must be a member of the project.
	if pm, err := ps.GetProjectMember(ctx, projectID, userID); err == nil && pm != nil {
		return nil
	}
	return ErrProjectNotFound
}
