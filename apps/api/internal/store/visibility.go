package store

import (
	"fmt"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
)

// ProjectVisibility restricts workspace-wide queries to the projects a caller
// may see. It mirrors ListVisibleByWorkspaceID and the service-layer
// enforceProjectVisibility gate: workspace admins/owners (SeeAll) see every
// project; everyone else sees public projects plus the ones they belong to.
type ProjectVisibility struct {
	UserID uuid.UUID
	SeeAll bool
}

// Clause returns a SQL predicate (and its args) over the projects table
// aliased as alias, or "" when no restriction applies.
func (v ProjectVisibility) Clause(alias string) (string, []any) {
	if v.SeeAll {
		return "", nil
	}
	return fmt.Sprintf(
		"(%[1]s.network = ? OR %[1]s.id IN (SELECT pm.project_id FROM project_members pm WHERE pm.member_id = ? AND pm.deleted_at IS NULL))",
		alias,
	), []any{model.NetworkPublic, v.UserID}
}

// andClause is Clause prefixed with " AND " for appending to raw SQL; it
// returns "" when no restriction applies.
func (v ProjectVisibility) andClause(alias string) (string, []any) {
	c, args := v.Clause(alias)
	if c == "" {
		return "", nil
	}
	return " AND " + c, args
}
