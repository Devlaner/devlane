package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealth(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/health", "")
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "ok", body["status"])
}

func TestReadiness(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/ready", "")
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "ready", body["status"])
}

func TestUnknownRouteReturns404(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/no/such/path", "")
	require.Equal(t, http.StatusNotFound, rr.Code)
}
