package store

import (
	"context"
	"github.com/Devlaner/devlane/api/internal/model"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

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
func (s *SearchStore) Search(ctx context.Context, workspaceID uuid.UUID, query string, projectID *uuid.UUID, limit int, vis ProjectVisibility) (SearchResults, error) {
	res := EmptyResults()
	pat := likePattern(query)
	// Restrict every group to projects the caller may see (secret projects
	// are hidden from non-members who are not workspace admins).
	visible := func(q *gorm.DB, alias string) *gorm.DB {
		if c, args := vis.Clause(alias); c != "" {
			return q.Where(c, args...)
		}
		return q
	}

	// Work items / epics: match by name or "IDENTIFIER-seq" (e.g. "DEV-42").
	searchIssues := func(epic bool, dst *[]SearchHit) error {
		q := s.db.WithContext(ctx).Table("issues AS i").
			Select("i.id, i.name, i.project_id, i.sequence_id, p.identifier AS project_identifier").
			Joins("JOIN projects p ON p.id = i.project_id AND p.deleted_at IS NULL").
			Where("i.workspace_id = ? AND i.deleted_at IS NULL AND i.archived_at IS NULL AND i.is_epic = ?", workspaceID, epic).
			Where("(i.name ILIKE ? OR (p.identifier || '-' || i.sequence_id::text) ILIKE ?)", pat, pat)
		if projectID != nil {
			q = q.Where("i.project_id = ?", *projectID)
		}
		q = visible(q, "p")
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
			Where("e.workspace_id = ? AND e.deleted_at IS NULL AND e.name ILIKE ?", workspaceID, pat)
		if hasArchived {
			q = q.Where("e.archived_at IS NULL")
		}
		if projectID != nil {
			q = q.Where("e.project_id = ?", *projectID)
		}
		q = visible(q, "p")
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
	// Only projects the caller may see count as a page's home project, and a
	// page linked solely to hidden projects is not returned at all.
	pvis, pargs := vis.andClause("vp")
	linked := "SELECT pp.project_id, vp.identifier, pp.created_at FROM project_pages pp " +
		"JOIN projects vp ON vp.id = pp.project_id AND vp.deleted_at IS NULL " +
		"WHERE pp.page_id = pg.id AND pp.deleted_at IS NULL" + pvis
	selArgs := append(append([]any{}, pargs...), pargs...)
	if err := s.db.WithContext(ctx).Table("pages AS pg").
		Select("pg.id, pg.name, "+
			"(SELECT l.project_id FROM ("+linked+") l ORDER BY l.created_at ASC LIMIT 1) AS project_id, "+
			"(SELECT l.identifier FROM ("+linked+") l ORDER BY l.created_at ASC LIMIT 1) AS project_identifier", selArgs...).
		Where("pg.workspace_id = ? AND pg.deleted_at IS NULL AND pg.archived_at IS NULL AND pg.name ILIKE ?", workspaceID, pat).
		// Private pages are visible only to their owner (mirrors PageService).
		Where("(pg.access = ? OR pg.owned_by_id = ?)", model.PageAccessPublic, vis.UserID).
		Where("EXISTS ("+linked+")", pargs...).
		Order("pg.name ASC").Limit(limit).Scan(&res.Pages).Error; err != nil {
		return res, err
	}

	// Projects: match by name or identifier; project_id mirrors id for linking.
	if err := visible(s.db.WithContext(ctx).Table("projects AS p").
		Select("p.id, p.name, p.id AS project_id, p.identifier AS project_identifier").
		Where("p.workspace_id = ? AND p.deleted_at IS NULL AND (p.name ILIKE ? OR p.identifier ILIKE ?)", workspaceID, pat, pat), "p").
		Order("p.name ASC").Limit(limit).Scan(&res.Projects).Error; err != nil {
		return res, err
	}

	return res, nil
}
