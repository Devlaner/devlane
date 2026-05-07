package text

import (
	"testing"

	"github.com/google/uuid"
)

func TestParseMentionUserIDs(t *testing.T) {
	alice := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	bob := uuid.MustParse("22222222-2222-2222-2222-222222222222")

	tests := []struct {
		name string
		in   string
		want []uuid.UUID
	}{
		{
			name: "empty",
			in:   "",
			want: nil,
		},
		{
			name: "plain text without mentions",
			in:   "<p>just a comment with @username typed as plain text</p>",
			want: []uuid.UUID{},
		},
		{
			name: "single tiptap mention",
			in:   `<p>hey <span data-type="mention" data-id="11111111-1111-1111-1111-111111111111" data-label="Alice" class="mention">@Alice</span> please review</p>`,
			want: []uuid.UUID{alice},
		},
		{
			name: "two mentions deduped",
			in: `<p><span data-type="mention" data-id="11111111-1111-1111-1111-111111111111" data-label="Alice">@Alice</span>
				 <span data-type="mention" data-id="22222222-2222-2222-2222-222222222222" data-label="Bob">@Bob</span>
				 <span data-type="mention" data-id="11111111-1111-1111-1111-111111111111" data-label="Alice">@Alice</span></p>`,
			want: []uuid.UUID{alice, bob},
		},
		{
			name: "non-mention spans ignored",
			in:   `<p><span class="mention">@fake</span> not a real mention</p>`,
			want: []uuid.UUID{},
		},
		{
			name: "malformed UUID dropped",
			in:   `<p><span data-type="mention" data-id="not-a-uuid">@x</span></p>`,
			want: []uuid.UUID{},
		},
		{
			name: "mention nested in formatting",
			in:   `<p><strong><em><span data-type="mention" data-id="22222222-2222-2222-2222-222222222222">@Bob</span></em></strong></p>`,
			want: []uuid.UUID{bob},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ParseMentionUserIDs(tc.in)
			if len(got) != len(tc.want) {
				t.Fatalf("len mismatch: got %v, want %v", got, tc.want)
			}
			gotSet := make(map[uuid.UUID]bool, len(got))
			for _, id := range got {
				gotSet[id] = true
			}
			for _, id := range tc.want {
				if !gotSet[id] {
					t.Errorf("missing %s; got %v", id, got)
				}
			}
		})
	}
}
