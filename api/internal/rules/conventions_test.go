package rules

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Every rule ID must appear in at least one test in this package.
func TestEveryRuleIsTested(t *testing.T) {
	files, _ := filepath.Glob("*_test.go")
	var all strings.Builder
	for _, f := range files {
		if f == "conventions_test.go" {
			continue
		}
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		all.Write(b)
	}
	seen := map[string]bool{}
	for _, r := range All() {
		if seen[r.ID] {
			t.Errorf("duplicate rule id %s", r.ID)
		}
		seen[r.ID] = true
		if !strings.Contains(all.String(), `"`+r.ID+`"`) {
			t.Errorf("rule %s has no test: add one in a *_test.go file that uses the id %q", r.ID, r.ID)
		}
	}
}
