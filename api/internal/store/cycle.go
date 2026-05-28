package store

import (
	"context"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CycleStore handles cycle persistence.
type CycleStore struct{ db *gorm.DB }

func NewCycleStore(db *gorm.DB) *CycleStore { return &CycleStore{db: db} }

func (s *CycleStore) Create(ctx context.Context, c *model.Cycle) error {
	return s.db.WithContext(ctx).Create(c).Error
}

func (s *CycleStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Cycle, error) {
	var cy model.Cycle
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&cy).Error
	if err != nil {
		return nil, err
	}
	return &cy, nil
}

func (s *CycleStore) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.Cycle, error) {
	var list []model.Cycle
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).
		Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (s *CycleStore) Update(ctx context.Context, c *model.Cycle) error {
	return s.db.WithContext(ctx).Save(c).Error
}

func (s *CycleStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Cycle{}).Error
}

// CycleIssue
func (s *CycleStore) AddCycleIssue(ctx context.Context, ci *model.CycleIssue) error {
	return s.db.WithContext(ctx).Create(ci).Error
}

func (s *CycleStore) RemoveCycleIssue(ctx context.Context, cycleID, issueID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("cycle_id = ? AND issue_id = ?", cycleID, issueID).
		Delete(&model.CycleIssue{}).Error
}

func (s *CycleStore) ListCycleIssueIDs(ctx context.Context, cycleID uuid.UUID) ([]uuid.UUID, error) {
	var rows []struct{ IssueID uuid.UUID }
	err := s.db.WithContext(ctx).Model(&model.CycleIssue{}).
		Where("cycle_id = ?", cycleID).Select("issue_id").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.IssueID)
	}
	return ids, nil
}

func (s *CycleStore) CountIssuesByCycleIDs(ctx context.Context, cycleIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	out := make(map[uuid.UUID]int)
	if len(cycleIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		CycleID uuid.UUID `gorm:"column:cycle_id"`
		Count   int       `gorm:"column:count"`
	}
	err := s.db.WithContext(ctx).
		Model(&model.CycleIssue{}).
		Select("cycle_id, COUNT(*) as count").
		Where("cycle_id IN ?", cycleIDs).
		Group("cycle_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.CycleID] = r.Count
	}
	return out, nil
}

// CycleStateDistribution returns issue counts grouped by state group for a cycle.
func (s *CycleStore) CycleStateDistribution(ctx context.Context, cycleID uuid.UUID) (map[string]int, error) {
	var rows []struct {
		Group string `gorm:"column:grp"`
		Count int    `gorm:"column:count"`
	}
	err := s.db.WithContext(ctx).Raw(`
		SELECT COALESCE(st.group, 'backlog') AS grp, COUNT(i.id) AS count
		FROM cycle_issues ci
		JOIN issues i ON i.id = ci.issue_id AND i.deleted_at IS NULL
		LEFT JOIN states st ON st.id = i.state_id
		WHERE ci.cycle_id = ? AND ci.deleted_at IS NULL
		GROUP BY COALESCE(st.group, 'backlog')
	`, cycleID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := map[string]int{
		"backlog":   0,
		"unstarted": 0,
		"started":   0,
		"completed": 0,
		"cancelled": 0,
	}
	for _, r := range rows {
		out[r.Group] = r.Count
	}
	return out, nil
}

// CycleCompletionChart returns a date→count map of issues completed per day within the cycle's range.
func (s *CycleStore) CycleCompletionChart(ctx context.Context, cycleID uuid.UUID, startDate, endDate *time.Time) (map[string]int, error) {
	var rows []struct {
		Date  string `gorm:"column:dt"`
		Count int    `gorm:"column:count"`
	}
	q := s.db.WithContext(ctx).Raw(`
		SELECT TO_CHAR(i.updated_at, 'YYYY-MM-DD') AS dt, COUNT(i.id) AS count
		FROM cycle_issues ci
		JOIN issues i ON i.id = ci.issue_id AND i.deleted_at IS NULL
		JOIN states st ON st.id = i.state_id AND st.group = 'completed'
		WHERE ci.cycle_id = ? AND ci.deleted_at IS NULL
		GROUP BY TO_CHAR(i.updated_at, 'YYYY-MM-DD')
		ORDER BY dt
	`, cycleID)
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]int, len(rows))
	for _, r := range rows {
		out[r.Date] = r.Count
	}
	return out, nil
}
