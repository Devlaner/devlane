package service

import (
	"strings"
	"testing"
)

func TestParseCSV_MapsColumnsAndSkipsEmptyNames(t *testing.T) {
	in := "Title,Description,Priority,Status\n" +
		"Fix login,Users cannot sign in,High,In Progress\n" +
		"   ,orphan row with no title,,\n" +
		"Add search,,,Todo\n"
	rows, err := parseCSV(strings.NewReader(in))
	if err != nil {
		t.Fatalf("parseCSV: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows (empty-name skipped), got %d", len(rows))
	}
	if rows[0].Name != "Fix login" || rows[0].Description != "Users cannot sign in" ||
		rows[0].Priority != "High" || rows[0].State != "In Progress" {
		t.Errorf("row0 mapped wrong: %+v", rows[0])
	}
	if rows[1].Name != "Add search" || rows[1].State != "Todo" {
		t.Errorf("row1 mapped wrong: %+v", rows[1])
	}
}

func TestParseCSV_RequiresNameColumn(t *testing.T) {
	if _, err := parseCSV(strings.NewReader("foo,bar\n1,2\n")); err != ErrImportNoName {
		t.Errorf("expected ErrImportNoName, got %v", err)
	}
}

func TestParseCSV_EmptyIsRejected(t *testing.T) {
	if _, err := parseCSV(strings.NewReader("")); err != ErrImportEmpty {
		t.Errorf("expected ErrImportEmpty, got %v", err)
	}
}

func TestNormalizePriority(t *testing.T) {
	cases := map[string]string{
		"Urgent": "urgent", "HIGH": "high", "med": "medium", "medium": "medium",
		"low": "low", "": "none", "whatever": "none",
	}
	for in, want := range cases {
		if got := normalizePriority(in); got != want {
			t.Errorf("normalizePriority(%q) = %q, want %q", in, got, want)
		}
	}
}
