package testutil

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Devlaner/devlane/api/internal/middleware"
)

// Do dispatches an HTTP request through the gin router and returns the recorder.
// body may be nil (no body), a string, []byte, io.Reader, or any JSON-marshallable value.
// sessionKey, if non-empty, is attached as the session_id cookie.
func (ts *TestServer) Do(method, path string, body any, sessionKey string) *httptest.ResponseRecorder {
	ts.T.Helper()

	var reader io.Reader
	contentType := ""
	switch v := body.(type) {
	case nil:
		reader = nil
	case io.Reader:
		reader = v
	case string:
		reader = strings.NewReader(v)
	case []byte:
		reader = bytes.NewReader(v)
	default:
		b, err := json.Marshal(v)
		if err != nil {
			ts.T.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(b)
		contentType = "application/json"
	}

	req := httptest.NewRequest(method, path, reader)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if sessionKey != "" {
		req.AddCookie(&http.Cookie{Name: middleware.SessionCookieName, Value: sessionKey})
	}

	rr := httptest.NewRecorder()
	ts.Router.ServeHTTP(rr, req)
	return rr
}

// DoWithHeaders is Do plus arbitrary header injection (e.g. Authorization: Bearer).
func (ts *TestServer) DoWithHeaders(method, path string, body any, headers http.Header) *httptest.ResponseRecorder {
	ts.T.Helper()

	var reader io.Reader
	contentType := ""
	switch v := body.(type) {
	case nil:
		reader = nil
	case io.Reader:
		reader = v
	case string:
		reader = strings.NewReader(v)
	case []byte:
		reader = bytes.NewReader(v)
	default:
		b, err := json.Marshal(v)
		if err != nil {
			ts.T.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(b)
		contentType = "application/json"
	}

	req := httptest.NewRequest(method, path, reader)
	if contentType != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", contentType)
	}
	for k, vs := range headers {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	rr := httptest.NewRecorder()
	ts.Router.ServeHTTP(rr, req)
	return rr
}

func (ts *TestServer) GET(path, sessionKey string) *httptest.ResponseRecorder {
	return ts.Do(http.MethodGet, path, nil, sessionKey)
}

func (ts *TestServer) POST(path string, body any, sessionKey string) *httptest.ResponseRecorder {
	return ts.Do(http.MethodPost, path, body, sessionKey)
}

func (ts *TestServer) PUT(path string, body any, sessionKey string) *httptest.ResponseRecorder {
	return ts.Do(http.MethodPut, path, body, sessionKey)
}

func (ts *TestServer) PATCH(path string, body any, sessionKey string) *httptest.ResponseRecorder {
	return ts.Do(http.MethodPatch, path, body, sessionKey)
}

func (ts *TestServer) DELETE(path, sessionKey string) *httptest.ResponseRecorder {
	return ts.Do(http.MethodDelete, path, nil, sessionKey)
}

// DecodeJSON unmarshals a recorder body into T. Fatals on error.
func DecodeJSON[T any](t testing.TB, rr *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if rr.Body.Len() == 0 {
		return v
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode JSON: %v\nbody=%s", err, rr.Body.String())
	}
	return v
}

// MustJSONMap is a convenience for tests that just want to peek at fields by name.
func MustJSONMap(t testing.TB, rr *httptest.ResponseRecorder) map[string]any {
	return DecodeJSON[map[string]any](t, rr)
}
