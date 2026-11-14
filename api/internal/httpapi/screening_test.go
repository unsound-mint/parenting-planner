package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestScreeningIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/screening-questionnaires", nil},
		{"POST", m + "/screenings", map[string]any{"instrument": "epds", "answers": []int{0, 1, 0, 1, 0, 0, 1, 0, 0, 0}, "visibility": "private"}},
		{"GET", m + "/screenings", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
