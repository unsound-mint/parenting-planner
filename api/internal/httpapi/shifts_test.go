package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestShiftsIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"POST", m + "/shifts", map[string]any{"title": "Night feeds", "days": []string{"mon", "wed"}, "startTime": "22:00", "endTime": "02:00"}},
		{"GET", m + "/shifts", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
