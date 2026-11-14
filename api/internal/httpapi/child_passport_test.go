package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestChildPassportIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/children/00000000-0000-4000-8000-000000000001/passport", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
