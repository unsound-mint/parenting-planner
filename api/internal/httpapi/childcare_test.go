package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestChildcareOptionsAreNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("newborn")
	one := "/api/family/childcare-options/00000000-0000-4000-8000-000000000001"
	body := map[string]any{"name": "Little Harbor Early Learning", "kind": "daycare", "status": "toured"}
	for _, call := range []stubCall{
		{"GET", "/api/family/childcare-options", nil},
		{"POST", "/api/family/childcare-options", body},
		{"GET", one, nil},
		{"PUT", one, body},
		{"DELETE", one, nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
