package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestHealthLoggingIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"POST", m + "/immunizations", map[string]any{"vaccine": "tdap", "givenOn": "2026-11-10"}},
		{"POST", m + "/screenings", map[string]any{"kind": "glucose_screen", "takenOn": "2026-11-10", "visibility": "partner"}},
		{"POST", m + "/lab-results", map[string]any{"name": "Ferritin", "value": 12, "unit": "ng/mL", "refLow": 15, "refHigh": 150, "takenOn": "2026-11-10", "visibility": "private"}},
	} {
		call.expectNotImplemented(t, c)
	}
}
