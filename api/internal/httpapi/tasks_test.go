package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestTasksIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner).Id.String()
	for _, call := range []stubCall{
		{"POST", m + "/tasks", map[string]any{"title": "Pack phone charger", "kind": "hospital_bag", "bag": "mother"}},
		{"GET", m + "/tasks", nil},
		{"PATCH", m + "/tasks/00000000-0000-4000-8000-000000000001", map[string]any{"done": true}},
		{"POST", m + "/tasks/00000000-0000-4000-8000-000000000001/reassignment", map[string]any{"toMemberId": partner}},
		{"POST", m + "/tasks/00000000-0000-4000-8000-000000000001/reassignment/accept", nil},
		{"POST", m + "/tasks/00000000-0000-4000-8000-000000000001/reassignment/decline", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
