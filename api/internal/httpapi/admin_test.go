package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestAdminIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy") // the admin works on the session's own family copy
	for _, call := range []stubCall{
		{"GET", "/api/admin/content-items?kind=pregnancy_week", nil},
		{"PATCH", "/api/admin/content-items/pregnancy_week/week-25", map[string]any{"body": "Your baby can now hear your voice."}},
		{"POST", "/api/admin/content-items/pregnancy_week/week-25/reset", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
