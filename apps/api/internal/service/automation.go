package service

import (
	"context"
	"time"

	"github.com/Devlaner/devlane/api/internal/store"
)

// AutomationService runs project-level background automations.
type AutomationService struct {
	projects *store.ProjectStore
	issues   *store.IssueStore
}

func NewAutomationService(projects *store.ProjectStore, issues *store.IssueStore) *AutomationService {
	return &AutomationService{projects: projects, issues: issues}
}

// RunAutoArchive archives settled (completed/cancelled) work items in every
// project that has auto-archive enabled, once they have been untouched for the
// project's configured number of months. Returns the total archived. Safe to run
// repeatedly: already-archived items are skipped.
func (s *AutomationService) RunAutoArchive(ctx context.Context) (int64, error) {
	projects, err := s.projects.ListWithAutoArchive(ctx)
	if err != nil {
		return 0, err
	}
	var total int64
	for i := range projects {
		p := &projects[i]
		if p.ArchiveIn <= 0 {
			continue
		}
		cutoff := time.Now().AddDate(0, -p.ArchiveIn, 0)
		n, err := s.issues.ArchiveSettledBefore(ctx, p.ID, cutoff)
		if err != nil {
			return total, err
		}
		total += n
	}
	return total, nil
}
