package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestCarelogIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner).Id.String()
	for _, call := range []stubCall{
		{"POST", m + "/care-log", map[string]any{"kind": "feed", "startedAt": "2026-11-14T10:00:00Z", "feedMethod": "bottle_formula", "amountMl": 90}},
		{"GET", m + "/care-log", nil},
		{"POST", m + "/handoffs", map[string]any{"toMemberId": partner, "note": "Fed at 14:10"}},
		{"GET", m + "/handoffs", nil},
		{"POST", m + "/handoffs/00000000-0000-4000-8000-000000000001/accept", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
