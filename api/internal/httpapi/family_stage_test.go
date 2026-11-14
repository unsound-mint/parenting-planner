package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestFamilyStageIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"PATCH", m + "/family", map[string]any{"dueDate": "2027-01-15"}},
		{"POST", m + "/baby-arrival", map[string]any{"name": "Ava", "birthDate": "2026-11-14"}},
	} {
		call.expectNotImplemented(t, c)
	}
}
