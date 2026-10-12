package database

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/golang-migrate/migrate/v4/source"
)

func TestMigrationCatalog(t *testing.T) {
	// Opening the real catalog rejects duplicate version/direction pairs before
	// a database connection is attempted. Check both directions for every version
	// so a missing rollback cannot silently enter the catalog either.
	migrations, err := source.Open("file://" + filepath.Join("..", "..", "migrations"))
	if err != nil {
		t.Fatalf("open migration catalog: %v", err)
	}
	defer migrations.Close()
	version, err := migrations.First()
	if err != nil {
		t.Fatalf("first migration: %v", err)
	}
	for {
		up, _, err := migrations.ReadUp(version)
		if err != nil {
			t.Fatalf("read up migration %d: %v", version, err)
		}
		if _, err := io.Copy(io.Discard, up); err != nil {
			t.Fatalf("read up SQL %d: %v", version, err)
		}
		up.Close()
		down, _, err := migrations.ReadDown(version)
		if err != nil {
			t.Fatalf("read down migration %d: %v", version, err)
		}
		if _, err := io.Copy(io.Discard, down); err != nil {
			t.Fatalf("read down SQL %d: %v", version, err)
		}
		down.Close()
		next, err := migrations.Next(version)
		if errors.Is(err, os.ErrNotExist) {
			break
		}
		if err != nil {
			t.Fatalf("next migration after %d: %v", version, err)
		}
		version = next
	}
}
