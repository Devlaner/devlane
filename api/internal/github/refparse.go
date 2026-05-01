package github

import (
	"regexp"
	"strconv"
	"strings"
)

// IssueRef is a parsed reference from a PR title, body, branch, or commit message.
// (Identifier, Number) uniquely identifies a Devlane issue within a workspace
// (per the project_identifiers + issues.sequence_id pair).
type IssueRef struct {
	Identifier string // uppercase project identifier, e.g. "DEV"
	Number     int    // 1-based per-project sequence number
	Closes     bool   // true when prefixed with a closing keyword
}

// Identifier returns the canonical "DEV-42" form.
func (r IssueRef) String() string { return r.Identifier + "-" + strconv.Itoa(r.Number) }

// Closing keywords recognized in PR titles, bodies, and commit messages.
// Matches GitHub's own list, plus a few common variants.
var closingKeywords = map[string]bool{
	"close": true, "closes": true, "closed": true,
	"fix": true, "fixes": true, "fixed": true,
	"resolve": true, "resolves": true, "resolved": true,
	"complete": true, "completes": true, "completed": true,
}

// Loose match for IDENT-NUM tokens. We use uppercase A-Z for the identifier
// (Devlane project identifiers are stored uppercase, ≤7 chars). The number is
// up to 9 digits so we don't catch huge sequence numbers as PR refs by accident.
var refRegex = regexp.MustCompile(`(?i)\b([A-Z][A-Z0-9]{0,6})-(\d{1,9})\b`)

// branchSlugRegex captures DEV-42 references inside a branch name like
// "feat/dev-42-fix-thing", "username/DEV-42", "fix-DEV42-thing" (rare).
// We deliberately allow lowercase here because branches are typically kebab-case.
var branchRegex = regexp.MustCompile(`(?i)(?:^|[/_-])([A-Z][A-Z0-9]{0,6})-(\d{1,9})(?:[/_-]|$)`)

// ExtractRefs scans free-form text (PR title, PR body, commit message) for
// `IDENT-NUM` references and returns deduplicated IssueRefs. Closing intent is
// detected when a reference is immediately preceded (within ~12 chars) by a
// closing keyword.
//
// Examples:
//   "Fixes DEV-42"                    → [{DEV, 42, closes=true}]
//   "Closes DEV-12, refs ABC-3"       → [{DEV,12,true}, {ABC,3,false}]
//   "DEV-1 and DEV-2 in the body"     → [{DEV,1,false}, {DEV,2,false}]
func ExtractRefs(text string) []IssueRef {
	if text == "" {
		return nil
	}
	seen := make(map[string]int) // ident-num → index in out
	out := make([]IssueRef, 0, 4)
	matches := refRegex.FindAllStringSubmatchIndex(text, -1)
	for _, m := range matches {
		// m: [start end identStart identEnd numStart numEnd]
		identStart, identEnd := m[2], m[3]
		numStart, numEnd := m[4], m[5]
		ident := strings.ToUpper(text[identStart:identEnd])
		num, err := strconv.Atoi(text[numStart:numEnd])
		if err != nil || num <= 0 {
			continue
		}
		// Look back up to 16 chars for a closing keyword.
		back := identStart - 16
		if back < 0 {
			back = 0
		}
		preceding := strings.ToLower(text[back:identStart])
		closes := hasClosingKeywordBefore(preceding)

		key := ident + "-" + strconv.Itoa(num)
		if existing, ok := seen[key]; ok {
			// Merge: closes=true sticks if any reference is a closer.
			if closes && !out[existing].Closes {
				out[existing].Closes = true
			}
			continue
		}
		seen[key] = len(out)
		out = append(out, IssueRef{Identifier: ident, Number: num, Closes: closes})
	}
	return out
}

func hasClosingKeywordBefore(s string) bool {
	// Walk back to find the nearest word.
	end := len(s)
	for end > 0 {
		// Trim trailing non-letter chars (whitespace, punctuation).
		for end > 0 && !isLetter(s[end-1]) {
			end--
		}
		if end == 0 {
			return false
		}
		start := end
		for start > 0 && isLetter(s[start-1]) {
			start--
		}
		word := s[start:end]
		if closingKeywords[word] {
			return true
		}
		// Stop at the first word — closing keyword must immediately precede.
		return false
	}
	return false
}

func isLetter(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

// ExtractRefsFromBranch parses a branch name. Branch refs are never marked as
// closing (closing is intent expressed in commit/PR title/body, not in a name).
func ExtractRefsFromBranch(branch string) []IssueRef {
	if branch == "" {
		return nil
	}
	seen := make(map[string]bool)
	out := make([]IssueRef, 0, 2)
	matches := branchRegex.FindAllStringSubmatch(branch, -1)
	for _, m := range matches {
		if len(m) < 3 {
			continue
		}
		ident := strings.ToUpper(m[1])
		num, err := strconv.Atoi(m[2])
		if err != nil || num <= 0 {
			continue
		}
		key := ident + "-" + strconv.Itoa(num)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, IssueRef{Identifier: ident, Number: num})
	}
	return out
}

// MergeRefs unions multiple ref slices, preserving the strongest signals
// (Closes=true wins). Order follows the first occurrence across inputs.
func MergeRefs(slices ...[]IssueRef) []IssueRef {
	seen := make(map[string]int)
	out := make([]IssueRef, 0)
	for _, s := range slices {
		for _, r := range s {
			key := r.Identifier + "-" + strconv.Itoa(r.Number)
			if idx, ok := seen[key]; ok {
				if r.Closes && !out[idx].Closes {
					out[idx].Closes = true
				}
				continue
			}
			seen[key] = len(out)
			out = append(out, r)
		}
	}
	return out
}
