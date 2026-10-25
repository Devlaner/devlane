package store

import (
	"context"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// projectVisibleClause restricts a query joined to the projects table (aliased
// `alias`) to projects the user may see: public projects, projects they belong
// to, or any project when they're a workspace admin/owner. Mirrors the gate in
// ProjectService.GetByID so search can't leak secret-project content.
func projectVisibleClause(alias string, userID uuid.UUID) (string, []interface{}) {
	clause := "(" + alias + ".network = ?" +
		" OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = " + alias + ".id AND pm.member_id = ? AND pm.deleted_at IS NULL)" +
		" OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = " + alias + ".workspace_id AND wm.member_id = ? AND wm.role >= ? AND wm.deleted_at IS NULL))"
	return clause, []interface{}{model.NetworkPublic, userID, userID, model.RoleAdmin}
}

// SearchStore runs cross-entity text search within a workspace. It is pure DB:
// callers are responsible for authorizing the workspace/user first.
type SearchStore struct{ db *gorm.DB }

func NewSearchStore(db *gorm.DB) *SearchStore { return &SearchStore{db: db} }

// SearchHit is a single match. ProjectID/ProjectIdentifier/SequenceID are set
// only for entity types where they apply (e.g. work items carry all three;
// projects carry their own id + identifier).
type SearchHit struct {
	ID                uuid.UUID  `json:"id"`
	Name              string     `json:"name"`
	ProjectID         *uuid.UUID `json:"project_id,omitempty"`
	ProjectIdentifier string     `json:"project_identifier,omitempty"`
	SequenceID        *int       `json:"sequence_id,omitempty"`
}

// SearchResults groups hits by entity type. Every slice is non-nil so the JSON
// response always renders stable, empty arrays.
type SearchResults struct {
	Issues   []SearchHit `json:"issue"`
	Epics    []SearchHit `json:"epic"`
	Cycles   []SearchHit `json:"cycle"`
	Modules  []SearchHit `json:"module"`
	Views    []SearchHit `json:"view"`
	Pages    []SearchHit `json:"page"`
	Projects []SearchHit `json:"project"`
}

// EmptyResults returns a SearchResults with every group initialized to a
// non-nil empty slice (used for blank queries so the API shape stays stable).
func EmptyResults() SearchResults {
	return SearchResults{
		Issues:   []SearchHit{},
		Epics:    []SearchHit{},
		Cycles:   []SearchHit{},
		Modules:  []SearchHit{},
		Views:    []SearchHit{},
		Pages:    []SearchHit{},
		Projects: []SearchHit{},
	}
}

// likePattern builds a case-insensitive "contains" pattern, escaping the LIKE
// wildcards so user input can't broaden the match (Postgres ILIKE uses '\' as
// the default escape character).
func likePattern(q string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + r.Replace(q) + "%"
}

// Search returns matches across the workspace's entities. When projectID is
// non-nil the project-owned entities (issues, epics, cycles, modules, views)
// are scoped to that project and the workspace-level groups (pages, projects)
// are left empty. limit caps the number of hits per group.
func (s *SearchStore) Search(ctx context.Context, workspaceID uuid.UUID, query string, projectID *uuid.UUID, userID uuid.UUID, limit int) (SearchResults, error) {
	res := EmptyResults()
	pat := likePattern(query)
	visClause, visArgs := projectVisibleClause("p", userID)

	// Work items / epics: match by name or "IDENTIFIER-seq" (e.g. "DEV-42").
	searchIssues := func(epic bool, dst *[]SearchHit) error {
		q := s.db.WithContext(ctx).Table("issues AS i").
			Select("i.id, i.name, i.project_id, i.sequence_id, p.identifier AS project_identifier").
			Joins("JOIN projects p ON p.id = i.project_id AND p.deleted_at IS NULL").
			Where("i.workspace_id = ? AND i.deleted_at IS NULL AND i.archived_at IS NULL AND i.is_epic = ?", workspaceID, epic).
			Where("(i.name ILIKE ? OR (p.identifier || '-' || i.sequence_id::text) ILIKE ?)", pat, pat).
			Where(visClause, visArgs...)
		if projectID != nil {
			q = q.Where("i.project_id = ?", *projectID)
		}
		return q.Order("i.updated_at DESC").Limit(limit).Scan(dst).Error
	}
	if err := searchIssues(false, &res.Issues); err != nil {
		return res, err
	}
	if err := searchIssues(true, &res.Epics); err != nil {
		return res, err
	}

	// Project-owned, name-only entities. hasArchived gates the archived_at
	// filter for tables that have the column.
	searchNamed := func(table string, hasArchived bool, dst *[]SearchHit) error {
		q := s.db.WithContext(ctx).Table(table+" AS e").
			Select("e.id, e.name, e.project_id, p.identifier AS project_identifier").
			Joins("JOIN projects p ON p.id = e.project_id AND p.deleted_at IS NULL").
			Where("e.workspace_id = ? AND e.deleted_at IS NULL AND e.name ILIKE ?", workspaceID, pat).
			Where(visClause, visArgs...)
		if hasArchived {
			q = q.Where("e.archived_at IS NULL")
		}
		if projectID != nil {
			q = q.Where("e.project_id = ?", *projectID)
		}
		return q.Order("e.name ASC").Limit(limit).Scan(dst).Error
	}
	if err := searchNamed("cycles", true, &res.Cycles); err != nil {
		return res, err
	}
	if err := searchNamed("modules", false, &res.Modules); err != nil {
		return res, err
	}
	if err := searchNamed("views", false, &res.Views); err != nil {
		return res, err
	}

	// Workspace-level groups are only searched for unscoped (workspace) search.
	if projectID != nil {
		return res, nil
	}

	// Pages are workspace-level but navigated within a project; pick the first
	// linked project for the result link.
	if err := s.db.WithContext(ctx).Table("pages AS pg").
		Select(`pg.id, pg.name,
			(SELECT pp.project_id FROM project_pages pp WHERE pp.page_id = pg.id AND pp.deleted_at IS NULL ORDER BY pp.created_at ASC LIMIT 1) AS project_id,
			(SELECT p2.identifier FROM project_pages pp JOIN projects p2 ON p2.id = pp.project_id WHERE pp.page_id = pg.id AND pp.deleted_at IS NULL ORDER BY pp.created_at ASC LIMIT 1) AS project_identifier`).
		Where("pg.workspace_id = ? AND pg.deleted_at IS NULL AND pg.archived_at IS NULL AND pg.name ILIKE ?", workspaceID, pat).
		Where("(pg.access = ? OR pg.owned_by_id = ?)", model.PageAccessPublic, userID).
		Where("EXISTS (SELECT 1 FROM project_pages pp WHERE pp.page_id = pg.id AND pp.deleted_at IS NULL)").
		Order("pg.name ASC").Limit(limit).Scan(&res.Pages).Error; err != nil {
		return res, err
	}

	// Projects: match by name or identifier; project_id mirrors id for linking.
	if err := s.db.WithContext(ctx).Table("projects AS p").
		Select("p.id, p.name, p.id AS project_id, p.identifier AS project_identifier").
		Where("p.workspace_id = ? AND p.deleted_at IS NULL AND (p.name ILIKE ? OR p.identifier ILIKE ?)", workspaceID, pat, pat).
		Where(visClause, visArgs...).
		Order("p.name ASC").Limit(limit).Scan(&res.Projects).Error; err != nil {
		return res, err
	}

	return res, nil
}
