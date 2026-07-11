package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

// ErrNoProjectsSelected is returned when an export names no projects.
var ErrNoProjectsSelected = errors.New("no projects selected for export")

// ExportService generates issue exports and records them as history.
type ExportService struct {
	exporters *store.ExporterStore
	issues    *store.IssueStore
	states    *store.StateStore
	ps        *store.ProjectStore
	ws        *store.WorkspaceStore
}

func NewExportService(exporters *store.ExporterStore, issues *store.IssueStore, states *store.StateStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *ExportService {
	return &ExportService{exporters: exporters, issues: issues, states: states, ps: ps, ws: ws}
}

// ExportIssues builds an .xlsx workbook of the issues in the given projects and
// records the request in the export history. Membership and project scope are
// enforced. Returns the suggested filename and the file bytes.
func (s *ExportService) ExportIssues(ctx context.Context, slug string, userID uuid.UUID, projectIDs []uuid.UUID, name string) (string, []byte, error) {
	wrk, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, ErrWorkspaceNotFound
		}
		return "", nil, err
	}
	ok, err := s.ws.IsMember(ctx, wrk.ID, userID)
	if err != nil {
		return "", nil, err
	}
	if !ok {
		return "", nil, ErrWorkspaceForbidden
	}
	if len(projectIDs) == 0 {
		return "", nil, ErrNoProjectsSelected
	}
	for _, pid := range projectIDs {
		in, err := s.ps.IsInWorkspace(ctx, pid, wrk.ID)
		if err != nil {
			return "", nil, err
		}
		if !in {
			return "", nil, ErrProjectNotFound
		}
	}

	data, err := s.buildWorkbook(ctx, projectIDs)
	if err != nil {
		return "", nil, err
	}

	idStrings := make([]string, 0, len(projectIDs))
	for _, pid := range projectIDs {
		idStrings = append(idStrings, pid.String())
	}
	rec := &model.Exporter{
		Name:          name,
		Type:          "issue_exports",
		Provider:      "xlsx",
		Status:        "completed",
		WorkspaceID:   wrk.ID,
		InitiatedByID: userID,
		Filters:       model.JSONMap{"project_ids": idStrings},
	}
	if err := s.exporters.Create(ctx, rec); err != nil {
		return "", nil, err
	}

	return "devlane-issues-export.xlsx", data, nil
}

// ListHistory returns the workspace's export history (members only).
func (s *ExportService) ListHistory(ctx context.Context, slug string, userID uuid.UUID) ([]model.Exporter, error) {
	wrk, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}
	ok, err := s.ws.IsMember(ctx, wrk.ID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrWorkspaceForbidden
	}
	return s.exporters.ListByWorkspaceID(ctx, wrk.ID)
}

const exportPageSize = 500

func (s *ExportService) buildWorkbook(ctx context.Context, projectIDs []uuid.UUID) ([]byte, error) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	const sheet = "Issues"
	f.SetSheetName(f.GetSheetName(0), sheet)

	headers := []string{"Project", "ID", "Title", "State", "Priority", "Start Date", "Due Date", "Created At"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}

	row := 2
	for _, pid := range projectIDs {
		proj, err := s.ps.GetByID(ctx, pid)
		if err != nil {
			return nil, err
		}
		states, err := s.states.ListByProjectID(ctx, pid)
		if err != nil {
			return nil, err
		}
		stateName := make(map[uuid.UUID]string, len(states))
		for _, st := range states {
			stateName[st.ID] = st.Name
		}

		offset := 0
		for {
			batch, err := s.issues.ListByProjectID(ctx, pid, exportPageSize, offset)
			if err != nil {
				return nil, err
			}
			for i := range batch {
				iss := &batch[i]
				displayID := fmt.Sprintf("%s-%d", proj.Identifier, iss.SequenceID)
				st := ""
				if iss.StateID != nil {
					st = stateName[*iss.StateID]
				}
				values := []interface{}{
					proj.Name,
					displayID,
					iss.Name,
					st,
					iss.Priority,
					formatExportDate(iss.StartDate),
					formatExportDate(iss.TargetDate),
					iss.CreatedAt.UTC().Format("2006-01-02"),
				}
				for c, v := range values {
					cell, _ := excelize.CoordinatesToCellName(c+1, row)
					_ = f.SetCellValue(sheet, cell, v)
				}
				row++
			}
			if len(batch) < exportPageSize {
				break
			}
			offset += exportPageSize
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func formatExportDate(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.UTC().Format("2006-01-02")
}
