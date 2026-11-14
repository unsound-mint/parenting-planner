package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Stub test for #321; #322 replaces it with the real integration tests.
func TestCustomSessionIsNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	var e httpapi.Error
	c.Post("/api/demo/custom-sessions", map[string]string{
		"stage": "pregnancy", "dueDate": testutil.Now.AddDate(0, 3, 0).Format("2006-01-02"),
		"motherName": "Ana", "partnerName": "Sam",
	}, http.StatusNotImplemented, &e)
	if e.Code != "not_implemented" {
		t.Fatalf("code = %q, want not_implemented", e.Code)
	}
}
