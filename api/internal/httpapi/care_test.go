package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Placeholder until the care handlers land (#174): the contract exists and
// every endpoint answers 501. Replace with the four kinds of test from
// wellbeing_test.go (validation, privacy, audit, plan effect).
func TestCareEndpointsAreStubs(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	base := "/api/members/" + mom.Id.String()
	id := "00000000-0000-0000-0000-000000000001"

	c.Get(base+"/diary-entries", http.StatusNotImplemented, nil)
	c.Get(base+"/psychologist-agenda", http.StatusNotImplemented, nil)
	c.Get(base+"/psychologist-slots", http.StatusNotImplemented, nil)
	c.Post(base+"/diary-entries", map[string]any{"body": "x", "visibility": "private"}, http.StatusNotImplemented, nil)
	c.Post(base+"/psychologist-bookings", map[string]any{"slotId": id}, http.StatusNotImplemented, nil)
	c.Post(base+"/session-notes", map[string]any{"bookingId": id, "text": "x"}, http.StatusNotImplemented, nil)
}
