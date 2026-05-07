// Package text contains helpers for parsing rich-text content stored as HTML
// in issue descriptions and comments.
package text

import (
	"strings"

	"github.com/google/uuid"
	"golang.org/x/net/html"
)

// ParseMentionUserIDs extracts the deduplicated set of user IDs referenced by
// the editor's mention extension. Mentions serialize as
// <span data-type="mention" data-id="<UUID>" ...>@Label</span>.
//
// IDs that fail uuid.Parse are dropped silently. Returns nil for empty/invalid input.
func ParseMentionUserIDs(htmlContent string) []uuid.UUID {
	htmlContent = strings.TrimSpace(htmlContent)
	if htmlContent == "" {
		return nil
	}
	z := html.NewTokenizer(strings.NewReader(htmlContent))
	seen := make(map[uuid.UUID]struct{})
	out := make([]uuid.UUID, 0, 4)
	for {
		tt := z.Next()
		switch tt {
		case html.ErrorToken:
			return out
		case html.StartTagToken, html.SelfClosingTagToken:
			name, hasAttr := z.TagName()
			if string(name) != "span" || !hasAttr {
				continue
			}
			isMention := false
			var dataID string
			for {
				attrName, attrVal, more := z.TagAttr()
				switch string(attrName) {
				case "data-type":
					if string(attrVal) == "mention" {
						isMention = true
					}
				case "data-id":
					dataID = string(attrVal)
				}
				if !more {
					break
				}
			}
			if !isMention || dataID == "" {
				continue
			}
			id, err := uuid.Parse(dataID)
			if err != nil {
				continue
			}
			if _, dup := seen[id]; dup {
				continue
			}
			seen[id] = struct{}{}
			out = append(out, id)
		}
	}
}
