package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestInsuranceIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"POST", m + "/insurance-calls", map[string]any{"calledAt": "2026-11-14T15:00:00Z", "insurer": "Bluefield Health", "topic": "add_baby", "summary": "Add the baby within 30 days of birth; form 22B.", "referenceNumber": "BH-55102", "visibility": "family"}},
		{"GET", m + "/insurance-calls", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
