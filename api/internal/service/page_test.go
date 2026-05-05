package service

import (
	"testing"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
)

func TestPagePermissions(t *testing.T) {
	owner := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	other := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	now := time.Now()

	publicPage := &model.Page{ID: uuid.New(), OwnedByID: owner, Access: model.PageAccessPublic}
	privatePage := &model.Page{ID: uuid.New(), OwnedByID: owner, Access: model.PageAccessPrivate}
	lockedPublic := &model.Page{ID: uuid.New(), OwnedByID: owner, Access: model.PageAccessPublic, IsLocked: true}
	archivedPublic := &model.Page{ID: uuid.New(), OwnedByID: owner, Access: model.PageAccessPublic, ArchivedAt: &now}

	tests := []struct {
		name        string
		page        *model.Page
		userID      uuid.UUID
		isMember    bool
		wantView    bool
		wantContent bool
		wantMeta    bool
	}{
		{"owner-public", publicPage, owner, true, true, true, true},
		{"owner-private", privatePage, owner, true, true, true, true},
		{"owner-locked-public", lockedPublic, owner, true, true, true, true},
		{"owner-archived", archivedPublic, owner, true, true, false, true},

		// Owner who is no longer a workspace member loses all access — the
		// auth boundary is workspace membership, not ownership.
		{"owner-no-longer-member", publicPage, owner, false, false, false, false},

		{"member-public", publicPage, other, true, true, true, false},
		{"member-private", privatePage, other, true, false, false, false},
		{"member-locked-public", lockedPublic, other, true, true, false, false},
		{"member-archived", archivedPublic, other, true, true, false, false},

		{"non-member-public", publicPage, other, false, false, false, false},
		{"non-member-private", privatePage, other, false, false, false, false},
		{"non-member-locked", lockedPublic, other, false, false, false, false},

		{"nil page", nil, owner, true, false, false, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := canView(tc.page, tc.userID, tc.isMember); got != tc.wantView {
				t.Errorf("canView = %v; want %v", got, tc.wantView)
			}
			if got := canEditContent(tc.page, tc.userID, tc.isMember); got != tc.wantContent {
				t.Errorf("canEditContent = %v; want %v", got, tc.wantContent)
			}
			if got := canEditMeta(tc.page, tc.userID, tc.isMember); got != tc.wantMeta {
				t.Errorf("canEditMeta = %v; want %v", got, tc.wantMeta)
			}
		})
	}
}

func TestStripHTML(t *testing.T) {
	tests := map[string]string{
		"":                           "",
		"<p>hello world</p>":         "hello world",
		"<p>hi <b>there</b></p>":     "hi there",
		"<p>line1</p>\n<p>line2</p>": "line1 line2",
		`<p>tag with attr <span data-type="x">@bob</span></p>`: "tag with attr @bob",
	}
	for in, want := range tests {
		if got := stripHTML(in); got != want {
			t.Errorf("stripHTML(%q) = %q; want %q", in, got, want)
		}
	}
}
