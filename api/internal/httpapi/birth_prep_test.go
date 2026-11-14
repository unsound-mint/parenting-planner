package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestBirthPrepIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/birth-plan", nil},
		{"POST", m + "/labour-alerts", nil},
		{"GET", m + "/appointments/00000000-0000-4000-8000-000000000600/prep", nil},
		{"PUT", m + "/appointments/00000000-0000-4000-8000-000000000600/note", map[string]any{"text": "ok"}},
	} {
		call.expectNotImplemented(t, c)
	}
}
