package store

import (
	"context"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PageStore handles page, project_page, and page_versions persistence.
type PageStore struct{ db *gorm.DB }

func NewPageStore(db *gorm.DB) *PageStore { return &PageStore{db: db} }

// ListPagesOpts controls page list filtering. All fields are optional.
//
// Archived: nil hides archived (default Inbox view); &true returns only archived rows.
// ParentID: nil returns root pages only; &id returns children of that id; pass &uuid.Nil
// to mean "no parent filter — return everything".
type ListPagesOpts struct {
	Archived    *bool
	ParentID    *uuid.UUID
	OwnerID     *uuid.UUID
	UpdatedByID *uuid.UUID
	Search      string
	OnlyRoots   bool
}

func (s *PageStore) Create(ctx context.Context, p *model.Page) error {
	return s.db.WithContext(ctx).Create(p).Error
}

// CreateWithProjectLink inserts a page and, when projectID is non-nil, the
// matching project_pages link in a single transaction. This avoids leaving an
// orphan workspace page when the link insert fails. The page argument is
// updated in place with the generated ID.
func (s *PageStore) CreateWithProjectLink(ctx context.Context, p *model.Page, projectID *uuid.UUID, createdByID *uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(p).Error; err != nil {
			return err
		}
		if projectID != nil {
			link := &model.ProjectPage{
				ProjectID:   *projectID,
				PageID:      p.ID,
				WorkspaceID: p.WorkspaceID,
				CreatedByID: createdByID,
			}
			if err := tx.Create(link).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// DuplicateInTransaction copies a page along with its project_pages links in
// one transaction. Returns the new page (updated in place).
func (s *PageStore) DuplicateInTransaction(ctx context.Context, dup *model.Page, projectIDs []uuid.UUID, createdByID *uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(dup).Error; err != nil {
			return err
		}
		for _, pid := range projectIDs {
			link := &model.ProjectPage{
				ProjectID:   pid,
				PageID:      dup.ID,
				WorkspaceID: dup.WorkspaceID,
				CreatedByID: createdByID,
			}
			if err := tx.Create(link).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ArchiveTree archives a page and all its descendants in one transaction so
// failures don't leave a partially-archived subtree behind.
func (s *PageStore) ArchiveTree(ctx context.Context, rootID uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&model.Page{}).
			Where("id = ?", rootID).Update("archived_at", now).Error; err != nil {
			return err
		}
		if tx.Dialector.Name() == "postgres" {
			return tx.Exec(`
				WITH RECURSIVE descendants AS (
					SELECT id FROM pages WHERE parent_id = ? AND deleted_at IS NULL
					UNION ALL
					SELECT p.id FROM pages p
					JOIN descendants d ON p.parent_id = d.id
					WHERE p.deleted_at IS NULL
				)
				UPDATE pages SET archived_at = NOW(), updated_at = NOW()
				WHERE id IN (SELECT id FROM descendants) AND archived_at IS NULL
			`, rootID).Error
		}
		// Iterative fallback for non-Postgres (sqlite tests).
		queue := []uuid.UUID{rootID}
		for len(queue) > 0 {
			next := queue[0]
			queue = queue[1:]
			var children []model.Page
			if err := tx.
				Where("parent_id = ? AND deleted_at IS NULL", next).Find(&children).Error; err != nil {
				return err
			}
			for _, c := range children {
				if c.ArchivedAt == nil {
					if err := tx.Model(&model.Page{}).
						Where("id = ?", c.ID).Update("archived_at", now).Error; err != nil {
						return err
					}
				}
				queue = append(queue, c.ID)
			}
		}
		return nil
	})
}

func (s *PageStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Page, error) {
	var page model.Page
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&page).Error
	if err != nil {
		return nil, err
	}
	return &page, nil
}

// ListByWorkspaceID returns workspace-scoped pages with optional filters.
func (s *PageStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID, opts ListPagesOpts) ([]model.Page, error) {
	q := s.db.WithContext(ctx).Where("workspace_id = ? AND deleted_at IS NULL", workspaceID)
	q = applyPageFilters(q, opts)
	var list []model.Page
	err := q.Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

// ListByProjectID returns pages linked to the given project, with optional filters.
func (s *PageStore) ListByProjectID(ctx context.Context, projectID uuid.UUID, opts ListPagesOpts) ([]model.Page, error) {
	q := s.db.WithContext(ctx).Model(&model.Page{}).
		Joins("INNER JOIN project_pages ON project_pages.page_id = pages.id AND project_pages.deleted_at IS NULL").
		Where("project_pages.project_id = ? AND pages.deleted_at IS NULL", projectID)
	q = applyPageFilters(q, opts)
	var list []model.Page
	err := q.Order("pages.sort_order ASC, pages.created_at ASC").Find(&list).Error
	return list, err
}

// ListChildrenByParentID returns the immediate children of a page.
func (s *PageStore) ListChildrenByParentID(ctx context.Context, parentID uuid.UUID) ([]model.Page, error) {
	var list []model.Page
	err := s.db.WithContext(ctx).
		Where("parent_id = ? AND deleted_at IS NULL", parentID).
		Order("sort_order ASC, created_at ASC").
		Find(&list).Error
	return list, err
}

// ListProjectIDsForPage returns the project IDs a page is linked to.
func (s *PageStore) ListProjectIDsForPage(ctx context.Context, pageID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).Model(&model.ProjectPage{}).
		Where("page_id = ? AND deleted_at IS NULL", pageID).
		Pluck("project_id", &ids).Error
	return ids, err
}

func (s *PageStore) Update(ctx context.Context, p *model.Page) error {
	return s.db.WithContext(ctx).Save(p).Error
}

func (s *PageStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Page{}).Error
}

func (s *PageStore) Lock(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Page{}).
		Where("id = ?", id).Update("is_locked", true).Error
}

func (s *PageStore) Unlock(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Page{}).
		Where("id = ?", id).Update("is_locked", false).Error
}

func (s *PageStore) Archive(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Page{}).
		Where("id = ?", id).Update("archived_at", time.Now()).Error
}

func (s *PageStore) Unarchive(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Page{}).
		Where("id = ?", id).Update("archived_at", nil).Error
}

// ArchiveDescendants archives all descendants of rootID via a recursive CTE.
// Postgres-specific. Returns nil on non-Postgres dialects (test setup uses sqlite).
func (s *PageStore) ArchiveDescendants(ctx context.Context, rootID uuid.UUID) error {
	if s.db.Dialector.Name() != "postgres" {
		// Sqlite (used by tests) doesn't support recursive CTE updates the same way.
		// Walk the tree iteratively as a fallback.
		return s.archiveDescendantsIterative(ctx, rootID)
	}
	return s.db.WithContext(ctx).Exec(`
		WITH RECURSIVE descendants AS (
			SELECT id FROM pages WHERE parent_id = ? AND deleted_at IS NULL
			UNION ALL
			SELECT p.id FROM pages p
			JOIN descendants d ON p.parent_id = d.id
			WHERE p.deleted_at IS NULL
		)
		UPDATE pages SET archived_at = NOW(), updated_at = NOW()
		WHERE id IN (SELECT id FROM descendants) AND archived_at IS NULL
	`, rootID).Error
}

func (s *PageStore) archiveDescendantsIterative(ctx context.Context, rootID uuid.UUID) error {
	now := time.Now()
	queue := []uuid.UUID{rootID}
	for len(queue) > 0 {
		next := queue[0]
		queue = queue[1:]
		var children []model.Page
		if err := s.db.WithContext(ctx).
			Where("parent_id = ? AND deleted_at IS NULL", next).Find(&children).Error; err != nil {
			return err
		}
		for _, c := range children {
			if c.ArchivedAt == nil {
				if err := s.db.WithContext(ctx).Model(&model.Page{}).
					Where("id = ?", c.ID).Update("archived_at", now).Error; err != nil {
					return err
				}
			}
			queue = append(queue, c.ID)
		}
	}
	return nil
}

// SetAccess sets a page's access level (0 public, 1 private). Caller enforces ownership.
func (s *PageStore) SetAccess(ctx context.Context, id uuid.UUID, access int16) error {
	return s.db.WithContext(ctx).Model(&model.Page{}).
		Where("id = ?", id).Update("access", access).Error
}

// UpdateContent updates a page's HTML body and stamps updated_by_id/updated_at.
// Caller is responsible for enforcing edit permissions and recording a version row.
func (s *PageStore) UpdateContent(ctx context.Context, id uuid.UUID, html string, updatedByID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Page{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"description_html": html,
			"updated_by_id":    updatedByID,
			"updated_at":       time.Now(),
		}).Error
}

func (s *PageStore) AddProjectPage(ctx context.Context, pp *model.ProjectPage) error {
	return s.db.WithContext(ctx).Create(pp).Error
}

func (s *PageStore) RemoveProjectPage(ctx context.Context, projectID, pageID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("project_id = ? AND page_id = ?", projectID, pageID).
		Delete(&model.ProjectPage{}).Error
}

// ----- Page versions -----

func (s *PageStore) CreateVersion(ctx context.Context, v *model.PageVersion) error {
	return s.db.WithContext(ctx).Create(v).Error
}

func (s *PageStore) ListVersions(ctx context.Context, pageID uuid.UUID) ([]model.PageVersion, error) {
	var list []model.PageVersion
	err := s.db.WithContext(ctx).
		Where("page_id = ?", pageID).
		Order("last_saved_at DESC").
		Find(&list).Error
	return list, err
}

func (s *PageStore) GetVersion(ctx context.Context, versionID uuid.UUID) (*model.PageVersion, error) {
	var v model.PageVersion
	err := s.db.WithContext(ctx).Where("id = ?", versionID).First(&v).Error
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// ----- Helpers -----

func applyPageFilters(q *gorm.DB, opts ListPagesOpts) *gorm.DB {
	switch {
	case opts.Archived == nil:
		q = q.Where("pages.archived_at IS NULL")
	case *opts.Archived:
		q = q.Where("pages.archived_at IS NOT NULL")
	default:
		q = q.Where("pages.archived_at IS NULL")
	}
	if opts.OnlyRoots {
		q = q.Where("pages.parent_id IS NULL")
	} else if opts.ParentID != nil && *opts.ParentID != uuid.Nil {
		q = q.Where("pages.parent_id = ?", *opts.ParentID)
	}
	if opts.OwnerID != nil {
		q = q.Where("pages.owned_by_id = ?", *opts.OwnerID)
	}
	if opts.UpdatedByID != nil {
		q = q.Where("pages.updated_by_id = ?", *opts.UpdatedByID)
	}
	if s := strings.TrimSpace(opts.Search); s != "" {
		q = q.Where("LOWER(pages.name) LIKE ?", "%"+strings.ToLower(s)+"%")
	}
	return q
}
