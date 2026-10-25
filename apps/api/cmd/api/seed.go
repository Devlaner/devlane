package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/config"
	"github.com/Devlaner/devlane/api/internal/database"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Demo credentials for the local-development seed. Not secret; documented in the
// local dev guide. Never use in a real deployment.
const (
	seedEmail         = "demo@devlane.test"
	seedPassword      = "Demo1234!"
	seedFirstName     = "Demo"
	seedLastName      = "User"
	seedWorkspaceName = "Demo Workspace"
	seedWorkspaceSlug = "demo"
	seedProjectName   = "Getting Started"
	seedProjectIdent  = "DEMO"
)

// runSeed handles `api seed`: it populates a local database with a demo user,
// workspace, project, workflow states, and sample work items so a fresh clone
// has something to explore. Idempotent — a second run is a no-op.
func runSeed(args []string) int {
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
	if len(args) != 0 {
		fmt.Fprintln(os.Stderr, "usage: api seed")
		return 2
	}
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		return 1
	}
	db, err := database.NewDB(cfg, log)
	if err != nil {
		fmt.Fprintf(os.Stderr, "database: %v\n", err)
		return 1
	}
	if sqlDB, err := db.DB(); err == nil {
		defer sqlDB.Close()
	}
	if err := seedDevData(context.Background(), db); err != nil {
		fmt.Fprintf(os.Stderr, "seed failed: %v\n", err)
		return 1
	}
	return 0
}

func seedDevData(ctx context.Context, db *gorm.DB) error {
	userStore := store.NewUserStore(db)

	// Idempotency: if the demo user already exists, assume the DB is seeded.
	// A real lookup error (not just "not found") should surface, not be treated
	// as "needs seeding".
	existing, err := userStore.GetByEmail(ctx, seedEmail)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("check demo user: %w", err)
	}
	if existing != nil {
		fmt.Printf("seed: %s already exists — nothing to do\n", seedEmail)
		return nil
	}

	authSvc := auth.NewService(userStore, store.NewSessionStore(db), store.NewPasswordResetTokenStore(db))
	_, user, err := authSvc.SignUp(ctx, auth.SignUpRequest{
		Email:     seedEmail,
		Password:  seedPassword,
		FirstName: seedFirstName,
		LastName:  seedLastName,
	})
	if err != nil {
		return fmt.Errorf("create demo user: %w", err)
	}

	// Make the demo user an instance admin and mark the instance as set up, so
	// the app is immediately usable without the first-run setup wizard.
	admins := store.NewInstanceAdminStore(db)
	adminCount, err := admins.CountActive(ctx)
	if err != nil {
		return fmt.Errorf("count instance admins: %w", err)
	}
	if adminCount == 0 {
		if err := admins.Create(ctx, &model.InstanceAdmin{UserID: user.ID, Role: model.RoleOwner, IsVerified: true}); err != nil {
			return fmt.Errorf("create instance admin: %w", err)
		}
	}
	settings := store.NewInstanceSettingStore(db)
	generalRow, err := settings.Get(ctx, "general")
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("read instance settings: %w", err)
	}
	if generalRow == nil {
		if err := settings.Upsert(ctx, "general", model.JSONMap{
			"instance_id":                     "devlocalseed00000000000",
			"admin_email":                     seedEmail,
			"instance_name":                   "Devlane (local)",
			"only_admin_can_create_workspace": false,
		}); err != nil {
			return fmt.Errorf("seed instance settings: %w", err)
		}
	}

	wsSvc := service.NewWorkspaceService(store.NewWorkspaceStore(db), store.NewWorkspaceInviteStore(db), userStore)
	wrk, err := wsSvc.Create(ctx, seedWorkspaceName, seedWorkspaceSlug, "", user.ID)
	if err != nil {
		return fmt.Errorf("create workspace: %w", err)
	}

	projSvc := service.NewProjectService(store.NewProjectStore(db), store.NewProjectInviteStore(db), store.NewWorkspaceStore(db), userStore)
	proj, err := projSvc.Create(ctx, wrk.Slug, seedProjectName, seedProjectIdent, user.ID)
	if err != nil {
		return fmt.Errorf("create project: %w", err)
	}

	// Seed a standard set of workflow states, one marked default.
	stateStore := store.NewStateStore(db)
	seedStates := []struct {
		name, group, color string
		def                bool
		seq                float64
	}{
		{"Backlog", "backlog", "#94a3b8", false, 1000},
		{"Todo", "unstarted", "#6366f1", true, 2000},
		{"In Progress", "started", "#f59e0b", false, 3000},
		{"Done", "completed", "#22c55e", false, 4000},
		{"Cancelled", "cancelled", "#ef4444", false, 5000},
	}
	for _, st := range seedStates {
		m := &model.State{
			Name: st.name, Group: st.group, Color: st.color, Default: st.def,
			Sequence: st.seq, ProjectID: proj.ID, WorkspaceID: wrk.ID,
		}
		if err := stateStore.RestoreOrCreateByNameAndProject(ctx, m); err != nil {
			return fmt.Errorf("create state %q: %w", st.name, err)
		}
	}
	allStates, err := stateStore.ListByProjectID(ctx, proj.ID)
	if err != nil {
		return fmt.Errorf("list seeded states: %w", err)
	}
	stateByName := map[string]uuid.UUID{}
	for i := range allStates {
		stateByName[allStates[i].Name] = allStates[i].ID
	}

	issueSvc := service.NewIssueService(store.NewIssueStore(db), store.NewProjectStore(db), store.NewWorkspaceStore(db))
	issueSvc.SetActivityStore(store.NewIssueActivityStore(db))
	issueSvc.SetStateStore(stateStore)
	issueSvc.SetLabelStore(store.NewLabelStore(db))

	seedIssues := []struct {
		name, desc, priority, state string
	}{
		{"Welcome to Devlane 👋", "This is a sample work item. Open it to see the detail view, then try editing the state, priority, and assignees.", "high", "Todo"},
		{"Set up your first project", "Projects group work items. Create your own from the sidebar when you're ready.", "medium", "In Progress"},
		{"Explore the board and list layouts", "Switch layouts from the work-item view to see the same issues grouped differently.", "low", "Backlog"},
		{"Try importing issues from CSV", "The project work-item list has an Import CSV action for bulk-adding items.", "none", "Backlog"},
		{"Mark something Done", "Move a work item to the Done state to see it settle.", "medium", "Done"},
	}
	created := 0
	for _, di := range seedIssues {
		var stateID *uuid.UUID
		if id, ok := stateByName[di.state]; ok {
			id := id
			stateID = &id
		}
		if _, err := issueSvc.Create(ctx, wrk.Slug, proj.ID, user.ID,
			di.name, di.desc, di.priority, stateID, nil, nil, nil, nil, nil, false); err != nil {
			return fmt.Errorf("create issue %q: %w", di.name, err)
		}
		created++
	}

	fmt.Printf("seed: created user %s (password %s), workspace %q, project %q with %d work items\n",
		seedEmail, seedPassword, seedWorkspaceSlug, seedProjectIdent, created)
	fmt.Printf("seed: sign in at the web app with %s / %s\n", seedEmail, seedPassword)
	return nil
}
