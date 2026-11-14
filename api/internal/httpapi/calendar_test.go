package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestCalendarIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"GET", m + "/calendar-events", nil},
		{"POST", m + "/calendar-events", map[string]any{"kind": "appointment", "title": "OB visit", "startsAt": "2026-11-20T15:00:00Z", "visibility": "family"}},
		{"PATCH", m + "/calendar-events/00000000-0000-4000-8000-000000000001", map[string]any{"title": "OB visit", "neutralTitle": true}},
		{"POST", m + "/appointment-questions", map[string]any{"text": "Is my iron level fine?", "visibility": "private"}},
		{"GET", m + "/appointment-questions", nil},
		{"PATCH", m + "/appointment-questions/00000000-0000-4000-8000-000000000001", map[string]any{"answered": true}},
	} {
		call.expectNotImplemented(t, c)
	}
}
