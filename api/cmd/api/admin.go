package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/Devlaner/devlane/api/internal/config"
	"github.com/Devlaner/devlane/api/internal/database"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"gorm.io/gorm"
)

var (
	errNoSuchUser   = errors.New("no user with that email")
	errAlreadyAdmin = errors.New("user is already an instance admin")
)

// grantInstanceAdmin grants instance-admin to an existing user identified by
// email. Returns errNoSuchUser if no such user, errAlreadyAdmin if they already
// are one.
func grantInstanceAdmin(ctx context.Context, db *gorm.DB, email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return errors.New("email is required")
	}
	u, err := store.NewUserStore(db).GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errNoSuchUser
		}
		return fmt.Errorf("lookup user by email: %w", err)
	}
	if u == nil {
		return errNoSuchUser
	}
	admins := store.NewInstanceAdminStore(db)
	existing, err := admins.GetByUserID(ctx, u.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("lookup existing instance admin: %w", err)
	}
	if existing != nil {
		return errAlreadyAdmin
	}
	return admins.Create(ctx, &model.InstanceAdmin{UserID: u.ID, Role: model.RoleOwner, IsVerified: true})
}

// runAdmin handles the `api admin <subcommand>` operator commands and returns a
// process exit code. Currently only `grant <email>` is supported.
func runAdmin(args []string) int {
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
	if len(args) != 2 || args[0] != "grant" {
		fmt.Fprintln(os.Stderr, "usage: api admin grant <email>")
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
	email := strings.TrimSpace(strings.ToLower(args[1]))
	if err := grantInstanceAdmin(context.Background(), db, email); err != nil {
		fmt.Fprintf(os.Stderr, "grant failed: %v\n", err)
		return 1
	}
	fmt.Printf("granted instance-admin to %s\n", email)
	return 0
}

// bootstrapFirstAdmin self-heals an instance that has no instance admin yet by
// promoting the user named in general.admin_email (seeded at first-run setup).
// This keeps the instance-admin dashboard reachable on instances that were set
// up before the instance_admins table existed. Idempotent (no-op once any admin
// exists) and best-effort — any error is logged and startup continues.
func bootstrapFirstAdmin(ctx context.Context, db *gorm.DB, log *slog.Logger) {
	admins := store.NewInstanceAdminStore(db)
	n, err := admins.CountActive(ctx)
	if err != nil {
		log.Warn("bootstrap admin: count failed", "error", err)
		return
	}
	if n > 0 {
		return
	}
	row, err := store.NewInstanceSettingStore(db).Get(ctx, "general")
	if err != nil || row == nil {
		return
	}
	email, _ := row.Value["admin_email"].(string)
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return
	}
	u, err := store.NewUserStore(db).GetByEmail(ctx, email)
	if err != nil || u == nil {
		return
	}
	if err := admins.Create(ctx, &model.InstanceAdmin{UserID: u.ID, Role: model.RoleOwner, IsVerified: true}); err != nil {
		log.Warn("bootstrap admin: create failed", "error", err, "email", email)
		return
	}
	log.Info("bootstrapped instance admin from general.admin_email", "email", email)
}
