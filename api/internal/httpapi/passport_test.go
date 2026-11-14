package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace with the four reference tests (see wellbeing_test.go) when the
// handler lands.
func TestPassportIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	var e httpapi.Error
	c.Get("/api/members/"+mom.Id.String()+"/passport", http.StatusNotImplemented, &e)
	if e.Code != "not_implemented" {
		t.Errorf("code = %q", e.Code)
	}
}
