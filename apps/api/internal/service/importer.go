package service

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/queue"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrImportWorkspace = errors.New("workspace not found")
	ErrImportForbidden = errors.New("you do not have access to this project")
	ErrImportNotFound  = errors.New("import not found")
	ErrImportBadFile   = errors.New("could not parse the CSV file")
	ErrImportNoName    = errors.New("the CSV must have a name or title column")
	ErrImportEmpty     = errors.New("the CSV has no data rows")
)

// maxImportRows caps a single import so a huge upload cannot exhaust memory or
// the queue payload. Anything above is rejected with a clear error.
const maxImportRows = 5000

// ImporterService parses uploaded files into issues for a project. CSV is the
// only supported source today; Jira/GitHub bulk import are planned follow-ups.
type ImporterService struct {
	importers *store.ImporterStore
	ws        *store.WorkspaceStore
	ps        *store.ProjectStore
	states    *store.StateStore
	issues    *IssueService
	queue     *queue.Publisher // optional; nil -> run synchronously
	log       *slog.Logger
}

func NewImporterService(
	importers *store.ImporterStore,
	ws *store.WorkspaceStore,
	ps *store.ProjectStore,
	states *store.StateStore,
	issues *IssueService,
	q *queue.Publisher,
	log *slog.Logger,
) *ImporterService {
	return &ImporterService{importers: importers, ws: ws, ps: ps, states: states, issues: issues, queue: q, log: log}
}

// ensureAccess mirrors IssueService.ensureProjectAccess: caller must be a member
// of the workspace and the project must belong to it.
func (s *ImporterService) ensureAccess(ctx context.Context, slug string, projectID, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		return nil, ErrImportWorkspace
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrImportForbidden
	}
	in, _ := s.ps.IsInWorkspace(ctx, projectID, wrk.ID)
	if !in {
		return nil, ErrImportNotFound
	}
	return wrk, nil
}

// CreateCSV parses a CSV upload into pending import rows, persists the job, and
// enqueues it (or runs it inline when no queue is configured).
func (s *ImporterService) CreateCSV(ctx context.Context, slug string, projectID, userID uuid.UUID, filename string, r io.Reader) (*model.Importer, error) {
	wrk, err := s.ensureAccess(ctx, slug, projectID, userID)
	if err != nil {
		return nil, err
	}

	rows, err := parseCSV(r)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, ErrImportEmpty
	}
	if len(rows) > maxImportRows {
		return nil, fmt.Errorf("%w: at most %d rows are supported per import", ErrImportBadFile, maxImportRows)
	}

	pid := projectID
	im := &model.Importer{
		Service:        model.ImportServiceCSV,
		Status:         model.ImportStatusQueued,
		Data:           model.ImporterData{Rows: rows},
		TotalCount:     len(rows),
		SourceFilename: filename,
		ProjectID:      &pid,
		WorkspaceID:    wrk.ID,
		InitiatedByID:  userID,
		CreatedByID:    &userID,
		UpdatedByID:    &userID,
	}
	if err := s.importers.Create(ctx, im); err != nil {
		return nil, err
	}

	ranInline := false
	if s.queue != nil {
		if err := s.queue.PublishImport(ctx, queue.ImportPayload{ImporterID: im.ID.String()}); err != nil {
			if s.log != nil {
				s.log.Warn("import enqueue failed, running inline", "importer_id", im.ID, "error", err)
			}
			_ = s.Run(ctx, im.ID.String())
			ranInline = true
		}
	} else {
		// No queue available (optional infra): process synchronously so the
		// feature still works.
		_ = s.Run(ctx, im.ID.String())
		ranInline = true
	}
	// When processed inline, return the finished job so the caller sees the real
	// status/counts instead of the initial "queued" snapshot.
	if ranInline {
		if fresh, _ := s.importers.Get(ctx, im.ID); fresh != nil {
			return fresh, nil
		}
	}
	return im, nil
}

// List returns a project's imports, newest first.
func (s *ImporterService) List(ctx context.Context, slug string, projectID, userID uuid.UUID) ([]model.Importer, error) {
	if _, err := s.ensureAccess(ctx, slug, projectID, userID); err != nil {
		return nil, err
	}
	return s.importers.ListByProject(ctx, projectID)
}

// Get returns a single import (for status polling).
func (s *ImporterService) Get(ctx context.Context, slug string, projectID, userID, id uuid.UUID) (*model.Importer, error) {
	if _, err := s.ensureAccess(ctx, slug, projectID, userID); err != nil {
		return nil, err
	}
	im, err := s.importers.GetByID(ctx, projectID, id)
	if err != nil {
		return nil, err
	}
	if im == nil {
		return nil, ErrImportNotFound
	}
	return im, nil
}

// Run processes an import job: create one issue per parsed row, tracking
// progress and per-row failures. Invoked by the queue worker (or inline).
func (s *ImporterService) Run(ctx context.Context, importerID string) error {
	id, err := uuid.Parse(importerID)
	if err != nil {
		return err
	}
	im, err := s.importers.Get(ctx, id)
	if err != nil {
		return err
	}
	if im == nil {
		// The importer row is gone (deleted, or a stale queue message). Nothing
		// to process; log so it isn't silently swallowed, but ack the message.
		if s.log != nil {
			s.log.Warn("import run: importer not found", "importer_id", importerID)
		}
		return nil
	}
	// Skip anything already finished OR in-flight: on a redelivered message an
	// import left in "processing" (e.g. a mid-run crash) must not be replayed
	// from row zero, which would create duplicate issues.
	if im.Status == model.ImportStatusCompleted ||
		im.Status == model.ImportStatusPartial ||
		im.Status == model.ImportStatusProcessing {
		return nil
	}
	if im.ProjectID == nil {
		im.Status = model.ImportStatusFailed
		im.ErrorMessage = "import has no target project"
		return s.importers.UpdateProgress(ctx, im)
	}

	wrk, err := s.ws.GetByID(ctx, im.WorkspaceID)
	if err != nil || wrk == nil {
		im.Status = model.ImportStatusFailed
		im.ErrorMessage = "workspace not found"
		return s.importers.UpdateProgress(ctx, im)
	}

	// Map state names -> ids once for this project.
	stateByName := map[string]uuid.UUID{}
	if states, err := s.states.ListByProjectID(ctx, *im.ProjectID); err == nil {
		for i := range states {
			stateByName[strings.ToLower(strings.TrimSpace(states[i].Name))] = states[i].ID
		}
	}

	im.Status = model.ImportStatusProcessing
	im.ProcessedCount = 0
	im.ErrorCount = 0
	im.ErrorMessage = ""
	_ = s.importers.UpdateProgress(ctx, im)

	var firstErr string
	for _, row := range im.Data.Rows {
		var stateID *uuid.UUID
		if row.State != "" {
			if sid, ok := stateByName[strings.ToLower(strings.TrimSpace(row.State))]; ok {
				sid := sid
				stateID = &sid
			}
		}
		_, cerr := s.issues.Create(ctx, wrk.Slug, *im.ProjectID, im.InitiatedByID,
			row.Name, row.Description, normalizePriority(row.Priority),
			stateID, nil, nil, nil, nil, nil, false)
		if cerr != nil {
			im.ErrorCount++
			if firstErr == "" {
				firstErr = cerr.Error()
			}
		} else {
			im.ProcessedCount++
		}
		_ = s.importers.UpdateProgress(ctx, im)
	}

	switch {
	case im.ProcessedCount == 0:
		im.Status = model.ImportStatusFailed
	case im.ErrorCount > 0:
		im.Status = model.ImportStatusPartial
	default:
		im.Status = model.ImportStatusCompleted
	}
	if firstErr != "" {
		im.ErrorMessage = fmt.Sprintf("%d row(s) failed; first error: %s", im.ErrorCount, firstErr)
	}
	return s.importers.UpdateProgress(ctx, im)
}

// parseCSV reads a CSV with a header row and maps common columns (name/title,
// description, priority, state/status) into import rows. Rows without a name
// are skipped.
func parseCSV(r io.Reader) ([]model.ImportRow, error) {
	cr := csv.NewReader(r)
	cr.TrimLeadingSpace = true
	cr.FieldsPerRecord = -1 // tolerate ragged rows

	header, err := cr.Read()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return nil, ErrImportEmpty
		}
		return nil, fmt.Errorf("%w: %v", ErrImportBadFile, err)
	}

	col := map[string]int{}
	for i, h := range header {
		col[strings.ToLower(strings.TrimSpace(h))] = i
	}
	nameIdx, ok := firstIndex(col, "name", "title", "summary")
	if !ok {
		return nil, ErrImportNoName
	}
	descIdx, _ := firstIndex(col, "description", "body", "details")
	prioIdx, _ := firstIndex(col, "priority")
	stateIdx, _ := firstIndex(col, "state", "status")

	var rows []model.ImportRow
	for {
		rec, err := cr.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrImportBadFile, err)
		}
		name := strings.TrimSpace(field(rec, nameIdx))
		if name == "" {
			continue // skip rows with no title
		}
		rows = append(rows, model.ImportRow{
			Name:        name,
			Description: strings.TrimSpace(field(rec, descIdx)),
			Priority:    strings.TrimSpace(field(rec, prioIdx)),
			State:       strings.TrimSpace(field(rec, stateIdx)),
		})
	}
	return rows, nil
}

func firstIndex(col map[string]int, names ...string) (int, bool) {
	for _, n := range names {
		if i, ok := col[n]; ok {
			return i, true
		}
	}
	return -1, false
}

func field(rec []string, idx int) string {
	if idx < 0 || idx >= len(rec) {
		return ""
	}
	return rec[idx]
}

// normalizePriority maps free-text priority to the app's allowed set, defaulting
// to "none" for anything unrecognized.
func normalizePriority(p string) string {
	switch strings.ToLower(strings.TrimSpace(p)) {
	case "urgent":
		return "urgent"
	case "high":
		return "high"
	case "medium", "med":
		return "medium"
	case "low":
		return "low"
	default:
		return "none"
	}
}
