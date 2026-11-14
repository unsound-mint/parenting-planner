package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestInvitationsIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"POST", m + "/invitations", map[string]any{"role": "nanny", "displayName": "Maria", "permissions": []string{"care_log", "baby_passport"}}},
		{"GET", m + "/invitations", nil},
		{"POST", m + "/invitations/00000000-0000-4000-8000-000000000001/revoke", nil},
		{"GET", "/api/invitations/abcdefghijklmnopqrstuvwxyz", nil},
		{"POST", "/api/invitations/abcdefghijklmnopqrstuvwxyz/accept", nil},
		{"GET", m + "/access-log", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
