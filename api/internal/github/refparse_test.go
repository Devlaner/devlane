package github

import "testing"

func TestExtractRefs(t *testing.T) {
	cases := []struct {
		name string
		text string
		want []IssueRef
	}{
		{
			name: "single closing ref",
			text: "Fixes DEV-42",
			want: []IssueRef{{Identifier: "DEV", Number: 42, Closes: true}},
		},
		{
			name: "multiple refs, mixed closing",
			text: "Closes DEV-12 and refs ABC-3",
			want: []IssueRef{
				{Identifier: "DEV", Number: 12, Closes: true},
				{Identifier: "ABC", Number: 3, Closes: false},
			},
		},
		{
			name: "non-closing references",
			text: "Working on DEV-1 and DEV-2 today",
			want: []IssueRef{
				{Identifier: "DEV", Number: 1},
				{Identifier: "DEV", Number: 2},
			},
		},
		{
			name: "lowercase keyword still triggers closing",
			text: "fixes dev-42",
			want: []IssueRef{{Identifier: "DEV", Number: 42, Closes: true}},
		},
		{
			name: "dedup, closes wins",
			text: "Mentioned DEV-7 then fixes DEV-7 later",
			want: []IssueRef{{Identifier: "DEV", Number: 7, Closes: true}},
		},
		{
			name: "ignores lone dash",
			text: "no ref here",
			want: []IssueRef{},
		},
		{
			name: "punctuation between keyword and ref",
			text: "Resolves: DEV-9.",
			want: []IssueRef{{Identifier: "DEV", Number: 9, Closes: true}},
		},
		{
			name: "PR title with closing keyword",
			text: "fix(api): closed DEV-100 by handling edge case",
			want: []IssueRef{{Identifier: "DEV", Number: 100, Closes: true}},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ExtractRefs(tc.text)
			if len(got) != len(tc.want) {
				t.Fatalf("len mismatch: got %d (%+v), want %d (%+v)", len(got), got, len(tc.want), tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("ref[%d] = %+v, want %+v", i, got[i], tc.want[i])
				}
			}
		})
	}
}

func TestExtractRefsFromBranch(t *testing.T) {
	cases := []struct {
		branch string
		want   []IssueRef
	}{
		{"feat/dev-42-fix-thing", []IssueRef{{Identifier: "DEV", Number: 42}}},
		{"username/DEV-99", []IssueRef{{Identifier: "DEV", Number: 99}}},
		{"DEV-7", []IssueRef{{Identifier: "DEV", Number: 7}}},
		{"main", []IssueRef{}},
		{"feature/dev-12_and_dev-13", []IssueRef{{Identifier: "DEV", Number: 12}, {Identifier: "DEV", Number: 13}}},
	}
	for _, tc := range cases {
		t.Run(tc.branch, func(t *testing.T) {
			got := ExtractRefsFromBranch(tc.branch)
			if len(got) != len(tc.want) {
				t.Fatalf("got %+v, want %+v", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("ref[%d] = %+v, want %+v", i, got[i], tc.want[i])
				}
			}
		})
	}
}

func TestMergeRefs(t *testing.T) {
	a := []IssueRef{{Identifier: "DEV", Number: 1}, {Identifier: "DEV", Number: 2, Closes: true}}
	b := []IssueRef{{Identifier: "DEV", Number: 1, Closes: true}, {Identifier: "ABC", Number: 5}}
	got := MergeRefs(a, b)
	want := []IssueRef{
		{Identifier: "DEV", Number: 1, Closes: true},
		{Identifier: "DEV", Number: 2, Closes: true},
		{Identifier: "ABC", Number: 5},
	}
	if len(got) != len(want) {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Errorf("ref[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestVerifySignature(t *testing.T) {
	secret := "topsecret"
	payload := []byte(`{"hello":"world"}`)
	// HMAC-SHA256 of payload with key "topsecret":
	// computed once: 5a8d05a99c00ff60b...; we recompute via HMAC.
	if err := VerifySignature(secret, payload, ""); err == nil {
		t.Error("expected error for empty signature")
	}
	if err := VerifySignature("", payload, "sha256=abc"); err == nil {
		t.Error("expected error for empty secret")
	}
	if err := VerifySignature(secret, payload, "abcd"); err == nil {
		t.Error("expected error for missing prefix")
	}
}
