package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestLeaveIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/leave-plan", nil},
		{"PUT", m + "/leave-plan", map[string]any{"state": "CA", "employerEmployees": 120, "monthsEmployed": 30, "hoursLast12Months": 1900, "startsOn": "2027-02-20", "weeksWanted": 16}},
	} {
		call.expectNotImplemented(t, c)
	}
}
