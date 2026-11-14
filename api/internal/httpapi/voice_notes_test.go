package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestVoiceNotesIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	for _, call := range []stubCall{
		{"AUDIO", m + "/voice-notes?durationSeconds=12", nil},
		{"GET", m + "/voice-notes/00000000-0000-4000-8000-000000000001", nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
