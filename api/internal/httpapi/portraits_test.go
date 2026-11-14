package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestPortraitsAreNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/portraits", nil},
		{"IMAGE", m + "/portraits?week=24", nil},
		{"DELETE", m + "/portraits/00000000-0000-4000-8000-000000000001", nil},
		{"GET", m + "/portraits/00000000-0000-4000-8000-000000000001/image", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
