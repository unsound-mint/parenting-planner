package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see child_passport_test.go) when
// its handler lands.
func TestMilestonesAreNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	child := "/children/" + fam.Children[0].Id.String()
	for _, call := range []stubCall{
		{"GET", m + child + "/milestones", nil},
		{"PUT", m + child + "/milestones/4y-language-sentences", map[string]any{"observed": true}},
	} {
		call.expectNotImplemented(t, c)
	}
}
