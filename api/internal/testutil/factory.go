package testutil

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// TestPassword is the password used by all factory-created users.
// It is hashed once at process start (cost 4) so factories don't pay
// the production-cost bcrypt overhead on every CreateUser.
const TestPassword = "TestPass123!"

var (
	hashOnce sync.Once
	cached   string
	counter  uint64
)

// testPasswordHash returns a precomputed bcrypt hash of TestPassword.
// CompareHashAndPassword does not care about the cost, so SignIn tests
// using this hash still validate correctly.
func testPasswordHash() string {
	hashOnce.Do(func() {
		h, err := bcrypt.GenerateFromPassword([]byte(TestPassword), bcrypt.MinCost)
		if err != nil {
			panic(fmt.Errorf("bcrypt: %w", err))
		}
		cached = string(h)
	})
	return cached
}

// nextN returns a unique-per-process counter for generating distinct emails/slugs.
func nextN() uint64 { return atomic.AddUint64(&counter, 1) }

// UserOpt customizes a factory-built user before insert.
type UserOpt func(*model.User)

func WithUserEmail(email string) UserOpt {
	return func(u *model.User) {
		e := strings.ToLower(strings.TrimSpace(email))
		u.Email = &e
	}
}

func WithUserName(first, last string) UserOpt {
	return func(u *model.User) {
		u.FirstName = first
		u.LastName = last
		u.DisplayName = strings.TrimSpace(first + " " + last)
	}
}

func WithUserInactive() UserOpt {
	return func(u *model.User) { u.IsActive = false }
}

func WithUserPasswordAutoset() UserOpt {
	return func(u *model.User) { u.IsPasswordAutoset = true }
}

// CreateUser inserts a user with TestPassword as the password and a unique
// email/username. Use WithUser* options to override.
func CreateUser(t testing.TB, db *gorm.DB, opts ...UserOpt) *model.User {
	t.Helper()
	n := nextN()
	email := fmt.Sprintf("user%d@test.local", n)
	u := &model.User{
		Username:    fmt.Sprintf("user%d", n),
		Email:       &email,
		Password:    testPasswordHash(),
		FirstName:   "Test",
		LastName:    fmt.Sprintf("User%d", n),
		DisplayName: fmt.Sprintf("Test User%d", n),
		IsActive:    true,
	}
	for _, opt := range opts {
		opt(u)
	}
	wantInactive := !u.IsActive
	wantAutoset := u.IsPasswordAutoset

	if err := store.NewUserStore(db).Create(context.Background(), u); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	// GORM lets the column DEFAULT win when struct fields equal Go's zero value.
	// is_active defaults to true and is_password_autoset to false in migrations,
	// so explicit overrides need a follow-up UPDATE to actually stick.
	updates := map[string]any{}
	if wantInactive {
		updates["is_active"] = false
	}
	if wantAutoset {
		updates["is_password_autoset"] = true
	}
	if len(updates) > 0 {
		if err := db.Model(u).Updates(updates).Error; err != nil {
			t.Fatalf("CreateUser: post-create update: %v", err)
		}
		// Reload so the caller sees the persisted state.
		if wantInactive {
			u.IsActive = false
		}
		if wantAutoset {
			u.IsPasswordAutoset = true
		}
	}
	return u
}

// Workspace member roles (matches int16 values used by the API).
const (
	RoleGuest  int16 = 5
	RoleMember int16 = 10
	RoleAdmin  int16 = 15
	RoleOwner  int16 = 20
)

// CreateWorkspace inserts a workspace owned by `ownerID` and seeds the
// owner as a WorkspaceMember with RoleOwner. Returns the workspace.
func CreateWorkspace(t testing.TB, db *gorm.DB, ownerID uuid.UUID) *model.Workspace {
	t.Helper()
	n := nextN()
	w := &model.Workspace{
		Name:    fmt.Sprintf("Workspace %d", n),
		Slug:    fmt.Sprintf("ws-%d", n),
		OwnerID: ownerID,
	}
	ws := store.NewWorkspaceStore(db)
	if err := ws.Create(context.Background(), w); err != nil {
		t.Fatalf("CreateWorkspace: %v", err)
	}
	if err := ws.AddMember(context.Background(), &model.WorkspaceMember{
		WorkspaceID: w.ID,
		MemberID:    ownerID,
		Role:        RoleOwner,
	}); err != nil {
		t.Fatalf("CreateWorkspace: add owner member: %v", err)
	}
	return w
}

// AddWorkspaceMember adds a user to a workspace at the given role.
func AddWorkspaceMember(t testing.TB, db *gorm.DB, workspaceID, userID uuid.UUID, role int16) *model.WorkspaceMember {
	t.Helper()
	m := &model.WorkspaceMember{
		WorkspaceID: workspaceID,
		MemberID:    userID,
		Role:        role,
	}
	if err := store.NewWorkspaceStore(db).AddMember(context.Background(), m); err != nil {
		t.Fatalf("AddWorkspaceMember: %v", err)
	}
	return m
}

// CreateProject inserts a project and adds `leadID` as a project member with
// RoleAdmin. Returns the project.
func CreateProject(t testing.TB, db *gorm.DB, workspaceID, leadID uuid.UUID) *model.Project {
	t.Helper()
	n := nextN()
	leadCopy := leadID
	p := &model.Project{
		Name:          fmt.Sprintf("Project %d", n),
		Identifier:    fmt.Sprintf("PRJ%d", n%10000),
		Slug:          fmt.Sprintf("prj-%d", n),
		WorkspaceID:   workspaceID,
		ProjectLeadID: &leadCopy,
		CreatedByID:   &leadCopy,
	}
	ps := store.NewProjectStore(db)
	if err := ps.Create(context.Background(), p); err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if err := ps.AddProjectMember(context.Background(), &model.ProjectMember{
		ProjectID:   p.ID,
		WorkspaceID: workspaceID,
		MemberID:    &leadCopy,
		Role:        RoleAdmin,
	}); err != nil {
		t.Fatalf("CreateProject: add lead member: %v", err)
	}
	return p
}

// AddProjectMember adds a user to a project at the given role.
func AddProjectMember(t testing.TB, db *gorm.DB, projectID, workspaceID, userID uuid.UUID, role int16) *model.ProjectMember {
	t.Helper()
	uid := userID
	m := &model.ProjectMember{
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		MemberID:    &uid,
		Role:        role,
	}
	if err := store.NewProjectStore(db).AddProjectMember(context.Background(), m); err != nil {
		t.Fatalf("AddProjectMember: %v", err)
	}
	return m
}

// CreateState inserts a workflow state for the project.
func CreateState(t testing.TB, db *gorm.DB, projectID, workspaceID uuid.UUID) *model.State {
	t.Helper()
	n := nextN()
	s := &model.State{
		Name:        fmt.Sprintf("State %d", n),
		Color:       "#abcdef",
		Group:       "backlog",
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
	}
	if err := store.NewStateStore(db).Create(context.Background(), s); err != nil {
		t.Fatalf("CreateState: %v", err)
	}
	return s
}

// CreateLabel inserts an issue label.
func CreateLabel(t testing.TB, db *gorm.DB, projectID, workspaceID uuid.UUID) *model.Label {
	t.Helper()
	n := nextN()
	pid := projectID
	l := &model.Label{
		Name:        fmt.Sprintf("Label %d", n),
		Color:       "#ff0000",
		ProjectID:   &pid,
		WorkspaceID: workspaceID,
	}
	if err := store.NewLabelStore(db).Create(context.Background(), l); err != nil {
		t.Fatalf("CreateLabel: %v", err)
	}
	return l
}

// CreateIssue inserts an issue. createdBy is required because IssueStore
// records it on activity logs.
func CreateIssue(t testing.TB, db *gorm.DB, projectID, workspaceID, createdByID uuid.UUID) *model.Issue {
	t.Helper()
	n := nextN()
	cb := createdByID
	i := &model.Issue{
		Name:        fmt.Sprintf("Issue %d", n),
		Priority:    "none",
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		CreatedByID: &cb,
		SequenceID:  int(n),
	}
	if err := store.NewIssueStore(db).Create(context.Background(), i); err != nil {
		t.Fatalf("CreateIssue: %v", err)
	}
	return i
}

// CreateCycle inserts a cycle owned by `ownedByID`.
func CreateCycle(t testing.TB, db *gorm.DB, projectID, workspaceID, ownedByID uuid.UUID) *model.Cycle {
	t.Helper()
	n := nextN()
	c := &model.Cycle{
		Name:        fmt.Sprintf("Cycle %d", n),
		Status:      "draft",
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		OwnedByID:   ownedByID,
	}
	if err := store.NewCycleStore(db).Create(context.Background(), c); err != nil {
		t.Fatalf("CreateCycle: %v", err)
	}
	return c
}

// CreateModule inserts a module.
func CreateModule(t testing.TB, db *gorm.DB, projectID, workspaceID uuid.UUID) *model.Module {
	t.Helper()
	n := nextN()
	m := &model.Module{
		Name:        fmt.Sprintf("Module %d", n),
		Status:      "backlog",
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
	}
	if err := store.NewModuleStore(db).Create(context.Background(), m); err != nil {
		t.Fatalf("CreateModule: %v", err)
	}
	return m
}

// CreatePage inserts a page in the workspace.
func CreatePage(t testing.TB, db *gorm.DB, workspaceID, ownedByID uuid.UUID) *model.Page {
	t.Helper()
	n := nextN()
	cb := ownedByID
	p := &model.Page{
		Name:        fmt.Sprintf("Page %d", n),
		WorkspaceID: workspaceID,
		OwnedByID:   ownedByID,
		Access:      model.PageAccessPublic,
		CreatedByID: &cb,
	}
	if err := store.NewPageStore(db).Create(context.Background(), p); err != nil {
		t.Fatalf("CreatePage: %v", err)
	}
	return p
}

// CreateView inserts a workspace-level issue view owned by `ownedByID`.
func CreateView(t testing.TB, db *gorm.DB, workspaceID, ownedByID uuid.UUID) *model.IssueView {
	t.Helper()
	n := nextN()
	v := &model.IssueView{
		Name:        fmt.Sprintf("View %d", n),
		WorkspaceID: workspaceID,
		OwnedByID:   ownedByID,
		Access:      1, // public
		Query:       model.JSONMap{},
	}
	if err := store.NewIssueViewStore(db).Create(context.Background(), v); err != nil {
		t.Fatalf("CreateView: %v", err)
	}
	return v
}

// CreateComment inserts a comment on an issue, authored by `authorID`.
func CreateComment(t testing.TB, db *gorm.DB, issueID, projectID, workspaceID, authorID uuid.UUID) *model.IssueComment {
	t.Helper()
	cb := authorID
	c := &model.IssueComment{
		IssueID:     issueID,
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		Comment:     "test comment " + time.Now().Format(time.RFC3339Nano),
		Access:      "INTERNAL",
		CreatedByID: &cb,
	}
	if err := store.NewCommentStore(db).Create(context.Background(), c); err != nil {
		t.Fatalf("CreateComment: %v", err)
	}
	return c
}

// CreateWorkspaceInvite inserts an invitation for `email` to join `workspaceID`.
func CreateWorkspaceInvite(t testing.TB, db *gorm.DB, workspaceID uuid.UUID, email, token string) *model.WorkspaceMemberInvite {
	t.Helper()
	inv := &model.WorkspaceMemberInvite{
		WorkspaceID: workspaceID,
		Email:       strings.ToLower(strings.TrimSpace(email)),
		Token:       token,
		Role:        RoleMember,
	}
	if err := store.NewWorkspaceInviteStore(db).Create(context.Background(), inv); err != nil {
		t.Fatalf("CreateWorkspaceInvite: %v", err)
	}
	return inv
}

// SeededWorld is a convenience bundle of common test fixtures: an admin user,
// a workspace they own, a project they lead, plus a session key for the user.
type SeededWorld struct {
	User      *model.User
	Workspace *model.Workspace
	Project   *model.Project
	Session   string
}

// SeedWorld creates the typical fixture set used by most handler tests:
// one user with a session, one workspace they own, one project they lead.
func SeedWorld(t testing.TB, db *gorm.DB) SeededWorld {
	t.Helper()
	u := CreateUser(t, db)
	w := CreateWorkspace(t, db, u.ID)
	p := CreateProject(t, db, w.ID, u.ID)
	s := LoginAs(t, db, u)
	return SeededWorld{User: u, Workspace: w, Project: p, Session: s}
}
