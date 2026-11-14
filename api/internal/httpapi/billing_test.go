package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestBillingIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"POST", m + "/checkout-sessions", map[string]any{"tier": "plus"}},
		{"GET", m + "/checkout-sessions/cs_test_123", nil},
		{"WEBHOOK", "/api/billing/stripe-webhook", map[string]any{"id": "evt_1", "type": "checkout.session.completed", "data": map[string]any{}}},
	} {
		call.expectNotImplemented(t, c)
	}
}
