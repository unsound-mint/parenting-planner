package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Stub test: replace with privacy, audit and plan tests when the handler lands (#173).
func TestMoodPatternsStubAnswers501(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	c.Get("/api/members/"+mom.Id.String()+"/mood-patterns", http.StatusNotImplemented, nil)
}
