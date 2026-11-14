package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestCalendarFeedIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/calendar-feed", nil},
		{"POST", m + "/calendar-feed", map[string]any{"scope": "mine"}},
		{"DELETE", m + "/calendar-feed", nil},
		{"GET", "/api/calendar-feeds/0123456789abcdef0123456789abcdef", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
