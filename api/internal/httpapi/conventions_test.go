package httpapi

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Every path in openapi.yaml must be called by at least one integration test.
func TestEveryEndpointHasAnIntegrationTest(t *testing.T) {
	spec, err := GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	files, _ := filepath.Glob("*_test.go")
	var all strings.Builder
	for _, f := range files {
		b, _ := os.ReadFile(f)
		all.Write(b)
	}
	for path := range spec.Paths.Map() {
		// Use the last fixed segment, e.g. "/mood-checkins" for /members/{memberId}/mood-checkins.
		segs := strings.Split(path, "/")
		last := ""
		for _, s := range segs {
			if s != "" && !strings.HasPrefix(s, "{") {
				last = "/" + s
			}
		}
		if !strings.Contains(all.String(), last+`"`) && !strings.Contains(all.String(), last+"/") {
			t.Errorf("no integration test calls %s (looked for %q in internal/httpapi/*_test.go)", path, last)
		}
	}
}
