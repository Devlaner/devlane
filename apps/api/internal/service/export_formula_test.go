package service

import "testing"

func TestNeutralizeFormula(t *testing.T) {
	cases := []struct {
		in   interface{}
		want interface{}
	}{
		{"=HYPERLINK(\"http://evil\")", "'=HYPERLINK(\"http://evil\")"},
		{"+1+2", "'+1+2"},
		{"-2+3", "'-2+3"},
		{"@SUM(A1)", "'@SUM(A1)"},
		{"\tstartsWithTab", "'\tstartsWithTab"},
		{"\rstartsWithCR", "'\rstartsWithCR"},
		{"Normal title", "Normal title"},
		{"", ""},
		{42, 42}, // non-string values pass through untouched
	}
	for _, tc := range cases {
		if got := neutralizeFormula(tc.in); got != tc.want {
			t.Errorf("neutralizeFormula(%q) = %q; want %q", tc.in, got, tc.want)
		}
	}
}
