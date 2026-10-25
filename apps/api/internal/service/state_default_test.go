package service

import "testing"

// Every seeded default state must use a group the app actually recognises.
// This guards against typos like "canceled" vs "cancelled", which silently
// broke auto-close, auto-archive and progress bucketing for every new project.
func TestDefaultProjectStatesUseValidGroups(t *testing.T) {
	for _, st := range defaultProjectStates {
		if !validStateGroups[st.group] {
			t.Errorf("default state %q has group %q which is not in validStateGroups", st.name, st.group)
		}
	}

	// The Cancelled state specifically must be in the "cancelled" group so
	// auto-close/archive and progress charts pick it up.
	var found bool
	for _, st := range defaultProjectStates {
		if st.name == "Cancelled" {
			found = true
			if st.group != "cancelled" {
				t.Errorf("Cancelled state group = %q; want \"cancelled\"", st.group)
			}
		}
	}
	if !found {
		t.Fatal("no default Cancelled state found")
	}
}
