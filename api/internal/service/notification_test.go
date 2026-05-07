package service

import (
	"strings"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
)

func TestDedupExclude(t *testing.T) {
	a := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	b := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	c := uuid.MustParse("33333333-3333-3333-3333-333333333333")

	tests := []struct {
		name      string
		receivers []uuid.UUID
		exclude   uuid.UUID
		want      []uuid.UUID
	}{
		{"empty", nil, a, nil},
		{"only excluded", []uuid.UUID{a, a}, a, []uuid.UUID{}},
		{"dedupes", []uuid.UUID{a, b, a, c, b}, uuid.Nil, []uuid.UUID{a, b, c}},
		{"removes nil", []uuid.UUID{a, uuid.Nil, b}, uuid.Nil, []uuid.UUID{a, b}},
		{"excludes actor and dedupes", []uuid.UUID{a, b, c, b, a}, b, []uuid.UUID{a, c}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := dedupExclude(tc.receivers, tc.exclude)
			if !sameOrderedUUIDs(got, tc.want) {
				t.Fatalf("dedupExclude(%v, %v) = %v; want %v", tc.receivers, tc.exclude, got, tc.want)
			}
		})
	}
}

func sameOrderedUUIDs(a, b []uuid.UUID) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestBuildTitle(t *testing.T) {
	tests := []struct {
		name           string
		sender         string
		actor          string
		ref            string
		field          string
		before, after  string
		wantContains   []string
		wantNotContain []string
	}{
		{
			name:         "assigned",
			sender:       model.NotificationSenderAssigned,
			actor:        "Sarah",
			ref:          "PRJ-42",
			wantContains: []string{"Sarah", "assigned", "PRJ-42"},
		},
		{
			name:         "mentioned",
			sender:       model.NotificationSenderMentioned,
			actor:        "Sarah",
			ref:          "PRJ-42",
			wantContains: []string{"Sarah", "mentioned", "PRJ-42"},
		},
		{
			name:         "commented",
			sender:       model.NotificationSenderCommented,
			actor:        "Sarah",
			ref:          "PRJ-42",
			wantContains: []string{"Sarah", "commented", "PRJ-42"},
		},
		{
			name:         "state with before+after",
			sender:       model.NotificationSenderStateChanged,
			actor:        "Sarah",
			ref:          "PRJ-42",
			before:       "Backlog",
			after:        "In Progress",
			wantContains: []string{"Sarah", "PRJ-42", "Backlog", "In Progress"},
		},
		{
			name:         "state with only after",
			sender:       model.NotificationSenderStateChanged,
			actor:        "Sarah",
			ref:          "PRJ-42",
			after:        "Done",
			wantContains: []string{"Sarah", "PRJ-42", "Done"},
		},
		{
			name:         "field changed (priority)",
			sender:       model.NotificationSenderSubscribed,
			actor:        "Sarah",
			ref:          "PRJ-42",
			field:        "priority",
			before:       "low",
			after:        "high",
			wantContains: []string{"Sarah", "priority", "PRJ-42", "low", "high"},
		},
		{
			name:           "field changed (target_date) maps to friendly label",
			sender:         model.NotificationSenderSubscribed,
			actor:          "Sarah",
			ref:            "PRJ-42",
			field:          "target_date",
			after:          "2026-05-15",
			wantContains:   []string{"due date", "PRJ-42"},
			wantNotContain: []string{"target_date"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := buildTitle(tc.sender, tc.actor, tc.ref, tc.field, tc.before, tc.after)
			for _, s := range tc.wantContains {
				if !strings.Contains(got, s) {
					t.Errorf("title %q missing %q", got, s)
				}
			}
			for _, s := range tc.wantNotContain {
				if strings.Contains(got, s) {
					t.Errorf("title %q must not contain %q", got, s)
				}
			}
		})
	}
}

func TestBuildMessage(t *testing.T) {
	actorID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	issueID := uuid.MustParse("22222222-2222-2222-2222-222222222222")

	in := messageInputs{
		actor: actorRef{id: actorID, name: "Sarah"},
		issue: issueRef2{id: issueID, name: "Fix login form", seq: 42, projectIdentifier: "PRJ"},
		field: "state",
		after: "In Progress",
	}
	m := buildMessage(in)

	actor, _ := m["actor"].(map[string]any)
	if actor["display_name"] != "Sarah" {
		t.Errorf("actor.display_name = %v; want Sarah", actor["display_name"])
	}
	if actor["id"] != actorID.String() {
		t.Errorf("actor.id = %v; want %s", actor["id"], actorID)
	}

	issue, _ := m["issue"].(map[string]any)
	if issue["sequence_id"] != 42 {
		t.Errorf("issue.sequence_id = %v; want 42", issue["sequence_id"])
	}
	if issue["project_identifier"] != "PRJ" {
		t.Errorf("issue.project_identifier = %v; want PRJ", issue["project_identifier"])
	}
	if issue["name"] != "Fix login form" {
		t.Errorf("issue.name = %v; want Fix login form", issue["name"])
	}

	if m["field"] != "state" {
		t.Errorf("field = %v; want state", m["field"])
	}
	if m["after"] != "In Progress" {
		t.Errorf("after = %v; want In Progress", m["after"])
	}
	// `before` is empty in input — should be omitted, not present as "".
	if _, ok := m["before"]; ok {
		t.Errorf("empty before should not be in message map")
	}
}

func TestStripPreview(t *testing.T) {
	tests := []struct {
		name string
		in   string
		max  int
		want string
	}{
		{"empty", "", 100, ""},
		{"plain text", "hello world", 100, "hello world"},
		{"strips tags", "<p>hello <strong>world</strong></p>", 100, "hello world"},
		{"collapses whitespace", "<p>hello\n\n    world\t!</p>", 100, "hello world !"},
		{"truncates with ellipsis", "abcdefghij", 5, "abcde…"},
		{"strips mention markup", `<p>hi <span data-type="mention" data-id="x">@bob</span> ok</p>`, 100, "hi @bob ok"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := stripPreview(tc.in, tc.max)
			if got != tc.want {
				t.Errorf("stripPreview(%q, %d) = %q; want %q", tc.in, tc.max, got, tc.want)
			}
		})
	}
}

func TestHumanFieldName(t *testing.T) {
	tests := map[string]string{
		"start_date":  "start date",
		"target_date": "due date",
		"parent":      "parent",
		"priority":    "priority",
		"name":        "title",
		"unknown":     "unknown",
	}
	for in, want := range tests {
		if got := humanFieldName(in); got != want {
			t.Errorf("humanFieldName(%q) = %q; want %q", in, got, want)
		}
	}
}
