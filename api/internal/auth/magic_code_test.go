package auth

import "testing"

func TestNormalizeMagicCode(t *testing.T) {
	t.Parallel()
	if got := NormalizeMagicCode(" 123 456 "); got != "123456" {
		t.Fatalf("got %q", got)
	}
	if got := NormalizeMagicCode("12-34-56"); got != "123456" {
		t.Fatalf("got %q", got)
	}
}

func TestMagicCodeHMAC_Deterministic(t *testing.T) {
	t.Parallel()
	a := MagicCodeHMAC("secret", "A@B.com", "123456")
	b := MagicCodeHMAC("secret", "a@b.com", "123456")
	if a != b {
		t.Fatalf("email case should not matter")
	}
	if MagicCodeHMAC("secret", "a@b.com", "123456") != MagicCodeHMAC("secret", "a@b.com", "1234 56") {
		t.Fatalf("spacing should not matter")
	}
	if MagicCodeHMAC("s1", "a@b.com", "123456") == MagicCodeHMAC("s2", "a@b.com", "123456") {
		t.Fatalf("secret should matter")
	}
}
