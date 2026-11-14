package store

// Mechanical checks of the backend conventions in api/AGENTS.md. If one of
// these fails, fix the code, not the test.

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func readDir(t *testing.T, glob string) map[string]string {
	t.Helper()
	files, err := filepath.Glob(glob)
	if err != nil || len(files) == 0 {
		t.Fatalf("no files for %s", glob)
	}
	out := map[string]string{}
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		out[f] = string(b)
	}
	return out
}

var createTable = regexp.MustCompile(`(?is)CREATE TABLE (\w+) \((.*?)\n\);`)

// sensitiveTables are tables with an owner_member_id: data that belongs to one parent.
func sensitiveTables(t *testing.T) map[string]string {
	out := map[string]string{}
	for _, sql := range readDir(t, "migrations/*.sql") {
		for _, m := range createTable.FindAllStringSubmatch(sql, -1) {
			if strings.Contains(m[2], "owner_member_id") {
				out[m[1]] = m[2]
			}
		}
	}
	return out
}

func TestSensitiveTablesHaveVisibility(t *testing.T) {
	for name, body := range sensitiveTables(t) {
		if !strings.Contains(body, "visibility") || !strings.Contains(body, "family_id") {
			t.Errorf("table %s has owner_member_id, so it must also have family_id and visibility", name)
		}
	}
}

var queryBlock = regexp.MustCompile(`(?m)^-- name: (\w+)`)

// Every SELECT from a sensitive table must apply the access rules: its name
// ends in VisibleToParent and its comment names the access function it mirrors.
func TestSensitiveReadsMirrorAccessRules(t *testing.T) {
	tables := sensitiveTables(t)
	for file, sql := range readDir(t, "queries/*.sql") {
		idx := queryBlock.FindAllStringSubmatchIndex(sql, -1)
		for i, m := range idx {
			name := sql[m[2]:m[3]]
			end := len(sql)
			if i+1 < len(idx) {
				end = idx[i+1][0]
			}
			// The comment lines directly above "-- name:" belong to this query.
			start := strings.LastIndex(sql[:m[0]], "\n\n") + 1
			block, comment := sql[m[0]:end], sql[start:m[0]]
			if !strings.Contains(strings.ToUpper(block), "SELECT") {
				continue
			}
			for table := range tables {
				if !regexp.MustCompile(`(?i)FROM\s+` + table + `\b`).MatchString(block) {
					continue
				}
				if !strings.HasSuffix(name, "VisibleToParent") || !strings.Contains(comment, "Mirrors access.") {
					t.Errorf("%s: query %s reads sensitive table %s; name it ...VisibleToParent and add a '-- Mirrors access.<Func>: ...' comment above it", file, name, table)
				}
			}
		}
	}
}
