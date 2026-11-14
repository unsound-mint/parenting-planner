package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace with the reference tests (see wellbeing_test.go) when the handler
// lands: reorder, remove, unknown_topic for the other parent's topic ids,
// 404 for a caregiver, audit.
func TestAgendaUpdateIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"PUT", m + "/psychologist-agenda", map[string]any{"topicIds": []string{"00000000-0000-4000-8000-000000000001"}}},
	} {
		call.expectNotImplemented(t, c)
	}
}
