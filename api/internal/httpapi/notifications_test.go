package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestNotificationsIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/notifications", nil},
		{"POST", m + "/notifications/read", map[string]any{"ids": []string{"00000000-0000-4000-8000-000000000001"}}},
	} {
		call.expectNotImplemented(t, c)
	}
}
