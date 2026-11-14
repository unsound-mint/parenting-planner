package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Placeholder until the directory is implemented (#175): the endpoints answer
// 501 and the web app shows an empty state. Replace with the real tests.
func TestDirectoryIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)

	c.Get("/api/providers", http.StatusNotImplemented, nil)
	c.Get("/api/members/"+mom.Id.String()+"/booking-requests", http.StatusNotImplemented, nil)
}
