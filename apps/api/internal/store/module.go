package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ModuleStore handles module persistence.
type ModuleStore struct{ db *gorm.DB }

func NewModuleStore(db *gorm.DB) *ModuleStore { return &ModuleStore{db: db} }

func (s *ModuleStore) Create(ctx context.Context, m *model.Module) error {
	return s.db.WithContext(ctx).Create(m).Error
}

// Tx runs fn inside a database transaction, passing a transaction-scoped store.
// Used to keep a module write and its member replacement atomic.
func (s *ModuleStore) Tx(ctx context.Context, fn func(tx *ModuleStore) error) error {
	return s.db.WithContext(ctx).Transaction(func(txdb *gorm.DB) error {
		return fn(&ModuleStore{db: txdb})
	})
}

func (s *ModuleStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Module, error) {
	var mod model.Module
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&mod).Error
	if err != nil {
		return nil, err
	}
	return &mod, nil
}

func (s *ModuleStore) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.Module, error) {
	var list []model.Module
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).
		Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (s *ModuleStore) Update(ctx context.Context, m *model.Module) error {
	return s.db.WithContext(ctx).Save(m).Error
}

func (s *ModuleStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Module{}).Error
}

func (s *ModuleStore) AddModuleIssue(ctx context.Context, mi *model.ModuleIssue) error {
	return s.db.WithContext(ctx).Create(mi).Error
}

func (s *ModuleStore) RemoveModuleIssue(ctx context.Context, moduleID, issueID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("module_id = ? AND issue_id = ?", moduleID, issueID).
		Delete(&model.ModuleIssue{}).Error
}

func (s *ModuleStore) ListModuleIssueIDs(ctx context.Context, moduleID uuid.UUID) ([]uuid.UUID, error) {
	var rows []struct{ IssueID uuid.UUID }
	err := s.db.WithContext(ctx).Model(&model.ModuleIssue{}).
		Where("module_id = ?", moduleID).Select("issue_id").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.IssueID)
	}
	return ids, nil
}

// ListLinksForModule returns a module's links, newest first.
func (s *ModuleStore) ListLinksForModule(ctx context.Context, moduleID uuid.UUID) ([]model.ModuleLink, error) {
	var list []model.ModuleLink
	err := s.db.WithContext(ctx).Where("module_id = ?", moduleID).
		Order("created_at DESC").Find(&list).Error
	return list, err
}

func (s *ModuleStore) CreateLink(ctx context.Context, l *model.ModuleLink) error {
	return s.db.WithContext(ctx).Create(l).Error
}

func (s *ModuleStore) GetLinkByID(ctx context.Context, linkID uuid.UUID) (*model.ModuleLink, error) {
	var l model.ModuleLink
	err := s.db.WithContext(ctx).Where("id = ?", linkID).First(&l).Error
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *ModuleStore) UpdateLink(ctx context.Context, l *model.ModuleLink) error {
	return s.db.WithContext(ctx).Save(l).Error
}

func (s *ModuleStore) DeleteLink(ctx context.Context, linkID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", linkID).Delete(&model.ModuleLink{}).Error
}

// SetMembers replaces a module's member set with memberIDs (in a transaction).
func (s *ModuleStore) SetMembers(ctx context.Context, moduleID uuid.UUID, memberIDs []uuid.UUID, actorID uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("module_id = ?", moduleID).Delete(&model.ModuleMember{}).Error; err != nil {
			return err
		}
		if len(memberIDs) == 0 {
			return nil
		}
		// De-dupe to respect the (module_id, member_id) unique constraint.
		seen := make(map[uuid.UUID]bool, len(memberIDs))
		rows := make([]model.ModuleMember, 0, len(memberIDs))
		for _, mid := range memberIDs {
			if mid == uuid.Nil || seen[mid] {
				continue
			}
			seen[mid] = true
			actor := actorID
			rows = append(rows, model.ModuleMember{
				ModuleID:    moduleID,
				MemberID:    mid,
				CreatedByID: &actor,
				UpdatedByID: &actor,
			})
		}
		if len(rows) == 0 {
			return nil
		}
		return tx.Create(&rows).Error
	})
}

// ListMemberIDs returns the member ids for a module.
func (s *ModuleStore) ListMemberIDs(ctx context.Context, moduleID uuid.UUID) ([]uuid.UUID, error) {
	var rows []struct{ MemberID uuid.UUID }
	err := s.db.WithContext(ctx).Model(&model.ModuleMember{}).
		Where("module_id = ?", moduleID).Select("member_id").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.MemberID)
	}
	return ids, nil
}

// ListMemberIDsByModuleIDs returns member ids for many modules, keyed by module id.
func (s *ModuleStore) ListMemberIDsByModuleIDs(ctx context.Context, moduleIDs []uuid.UUID) (map[uuid.UUID][]uuid.UUID, error) {
	out := make(map[uuid.UUID][]uuid.UUID)
	if len(moduleIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		ModuleID uuid.UUID `gorm:"column:module_id"`
		MemberID uuid.UUID `gorm:"column:member_id"`
	}
	err := s.db.WithContext(ctx).Model(&model.ModuleMember{}).
		Select("module_id, member_id").
		Where("module_id IN ?", moduleIDs).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.ModuleID] = append(out[r.ModuleID], r.MemberID)
	}
	return out, nil
}

func (s *ModuleStore) CountIssuesByModuleIDs(ctx context.Context, moduleIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	out := make(map[uuid.UUID]int)
	if len(moduleIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		ModuleID uuid.UUID `gorm:"column:module_id"`
		Count    int       `gorm:"column:count"`
	}
	err := s.db.WithContext(ctx).
		Model(&model.ModuleIssue{}).
		Select("module_id, COUNT(*) as count").
		Where("module_id IN ?", moduleIDs).
		Group("module_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.ModuleID] = r.Count
	}
	return out, nil
}
