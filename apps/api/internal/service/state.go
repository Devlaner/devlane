package service

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrStateNotFound = errors.New("state not found")

// ErrInvalidStateGroup is returned when an update sets a group outside the
// accepted workflow groups.
var ErrInvalidStateGroup = errors.New("invalid state group")

// validStateGroups is the accepted set of workflow-state groups.
var validStateGroups = map[string]bool{
	"backlog": true, "unstarted": true, "started": true, "completed": true, "cancelled": true,
}

// DefaultProjectStateNames are seeded for new projects (without triage).
var DefaultProjectStateNames = []string{"Backlog", "Todo", "In Progress", "Done", "Cancelled"}

// StateService handles state (workflow) business logic.
type StateService struct {
	ss *store.StateStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
}

func NewStateService(ss *store.StateStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *StateService {
	return &StateService{ss: ss, ps: ps, ws: ws}
}

func (s *StateService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) (uuid.UUID, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return uuid.Nil, ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return uuid.Nil, ErrProjectForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return uuid.Nil, ErrProjectNotFound
	}
	if err := enforceProjectVisibility(ctx, s.ps, s.ws, wrk.ID, projectID, userID); err != nil {
		return uuid.Nil, err
	}
	return wrk.ID, nil
}

func (s *StateService) List(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) ([]model.State, error) {
	workspaceID, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	list, err := s.ss.ListByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if len(list) > 0 {
		return list, nil
	}
	if err := s.ensureDefaultStates(ctx, projectID, workspaceID); err != nil {
		return nil, err
	}
	return s.ss.ListByProjectID(ctx, projectID)
}

// defaultProjectStates are the default workflow states (without triage).
var defaultProjectStates = []struct {
	name      string
	color     string
	sequence  float64
	group     string
	isDefault bool
}{
	{name: "Backlog", color: "#60646C", sequence: 15000, group: "backlog", isDefault: true},
	{name: "Todo", color: "#60646C", sequence: 25000, group: "unstarted"},
	{name: "In Progress", color: "#F59E0B", sequence: 35000, group: "started"},
	{name: "Done", color: "#46A758", sequence: 45000, group: "completed"},
	{name: "Cancelled", color: "#9AA4BC", sequence: 55000, group: "canceled"},
}

func (s *StateService) ensureDefaultStates(ctx context.Context, projectID, workspaceID uuid.UUID) error {
	list, err := s.ss.ListByProjectID(ctx, projectID)
	if err != nil {
		return err
	}
	if len(list) > 0 {
		return nil
	}
	for _, def := range defaultProjectStates {
		st := &model.State{
			Name:        def.name,
			Color:       def.color,
			Sequence:    def.sequence,
			Group:       def.group,
			Default:     def.isDefault,
			ProjectID:   projectID,
			WorkspaceID: workspaceID,
		}
		if err := s.ss.RestoreOrCreateByNameAndProject(ctx, st); err != nil {
			return err
		}
	}
	return nil
}

// EnsureDefaultStates seeds workflow states for a project that has none.
func (s *StateService) EnsureDefaultStates(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
	workspaceID, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return err
	}
	return s.ensureDefaultStates(ctx, projectID, workspaceID)
}

func (s *StateService) Create(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, color, group string) (*model.State, error) {
	workspaceID, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	if color == "" {
		color = "#0d0d0d"
	}
	if group == "" {
		group = "backlog"
	}
	st := &model.State{
		Name:        name,
		Color:       color,
		Group:       group,
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
	}
	if err := s.ss.Create(ctx, st); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *StateService) GetByID(ctx context.Context, workspaceSlug string, projectID, stateID uuid.UUID, userID uuid.UUID) (*model.State, error) {
	if _, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	st, err := s.ss.GetByID(ctx, stateID)
	if err != nil {
		return nil, ErrStateNotFound
	}
	if st.ProjectID != projectID {
		return nil, ErrStateNotFound
	}
	return st, nil
}

func (s *StateService) Update(ctx context.Context, workspaceSlug string, projectID, stateID uuid.UUID, userID uuid.UUID, name, color, group *string, sequence *float64, isDefault *bool) (*model.State, error) {
	st, err := s.GetByID(ctx, workspaceSlug, projectID, stateID, userID)
	if err != nil {
		return nil, err
	}
	// Write only the columns that changed so a full-row save can't clobber the
	// default flag (which is owned by the atomic SetDefault path).
	changed := map[string]any{}
	if name != nil {
		st.Name = *name
		changed["name"] = *name
	}
	if color != nil {
		st.Color = *color
		changed["color"] = *color
	}
	if group != nil {
		if !validStateGroups[*group] {
			return nil, ErrInvalidStateGroup
		}
		st.Group = *group
		changed["group"] = *group
	}
	if sequence != nil {
		st.Sequence = *sequence
		changed["sequence"] = *sequence
	}
	if isDefault != nil && !*isDefault {
		st.Default = false
		changed["default"] = false
	}
	if err := s.ss.UpdateFields(ctx, stateID, changed); err != nil {
		return nil, err
	}
	// Making a state the default must clear every other state's flag, so it runs
	// as its own atomic operation.
	if isDefault != nil && *isDefault {
		if err := s.ss.SetDefault(ctx, projectID, stateID); err != nil {
			return nil, err
		}
		st.Default = true
	}
	return st, nil
}

// Reorder atomically assigns new sequence values to a set of the project's
// states so a partial failure can't leave the order half-applied.
func (s *StateService) Reorder(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, items []store.StateSequence) error {
	if _, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return err
	}
	return s.ss.ReorderSequences(ctx, projectID, items)
}

func (s *StateService) Delete(ctx context.Context, workspaceSlug string, projectID, stateID uuid.UUID, userID uuid.UUID) error {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, stateID, userID)
	if err != nil {
		return err
	}
	return s.ss.Delete(ctx, stateID)
}
