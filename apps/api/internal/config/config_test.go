package config

import "testing"

func TestIsWeakSecret(t *testing.T) {
	weak := []string{
		"",
		"short",
		"change-me-generate-a-random-key",
		"change-me",
		"changeme",
		"0123456789abcde", // 15 chars
	}
	for _, v := range weak {
		if !isWeakSecret(v) {
			t.Errorf("isWeakSecret(%q) = false; want true", v)
		}
	}

	strong := []string{
		"0123456789abcdef",                  // 16 chars
		"a-perfectly-fine-random-key-value", // long, non-placeholder
	}
	for _, v := range strong {
		if isWeakSecret(v) {
			t.Errorf("isWeakSecret(%q) = true; want false", v)
		}
	}
}
