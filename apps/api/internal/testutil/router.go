package testutil

import (
	"io"
	"log/slog"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/router"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// TestServer bundles everything an HTTP-level test needs: the shared DB
// (already truncated to a clean state) and a real *gin.Engine built from
// router.New, so requests exercise the full middleware + handler stack.
type TestServer struct {
	T      testing.TB
	DB     *gorm.DB
	Router *gin.Engine
}

// NewTestServer brings up the shared Postgres container (lazy), truncates
// every table, and returns a fresh router. The MagicCodeSecret is fixed so
// magic-code tests are deterministic; CORSAllowOrigin is empty so the CORS
// middleware doesn't interfere.
//
// Note: gin runs in ReleaseMode here because router.New explicitly sets it
// — calling gin.SetMode in this function would be overwritten immediately.
func NewTestServer(t testing.TB) *TestServer {
	t.Helper()

	db := PG(t)
	TruncateAll(t, db)

	cfg := router.Config{
		Log:             slog.New(slog.NewTextHandler(io.Discard, &slog.HandlerOptions{Level: slog.LevelError})),
		DB:              db,
		MagicCodeSecret: "test-secret-32-bytes-long-enough!",
		AppBaseURL:      "http://localhost:5173",
		APIPublicURL:    "http://localhost:8080",
	}
	eng, _ := router.New(cfg)
	return &TestServer{
		T:      t,
		DB:     db,
		Router: eng,
	}
}

// ServeHTTP makes TestServer satisfy http.Handler so tests can also use
// httptest.NewServer if they need a real listening port.
func (ts *TestServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ts.Router.ServeHTTP(w, r)
}

var _ http.Handler = (*TestServer)(nil)
