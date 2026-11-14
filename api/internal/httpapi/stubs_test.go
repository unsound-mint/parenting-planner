package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// stubCall is one request to an endpoint whose handler is still a 501 stub.
// The body must be valid for the contract: the validator runs first and
// would answer 400 instead.
type stubCall struct {
	method string // GET, POST, PATCH, or WEBHOOK (POST with a Stripe-Signature header)
	path   string
	body   any
}

func (s stubCall) expectNotImplemented(t *testing.T, c *testutil.Client) {
	t.Helper()
	var e httpapi.Error
	switch s.method {
	case "GET":
		c.Get(s.path, http.StatusNotImplemented, &e)
	case "POST":
		c.Post(s.path, s.body, http.StatusNotImplemented, &e)
	case "PATCH":
		c.Patch(s.path, s.body, http.StatusNotImplemented, &e)
	case "WEBHOOK":
		c.PostWithHeaders(s.path, map[string]string{"Stripe-Signature": "t=1,v1=stub"}, s.body, http.StatusNotImplemented, &e)
	default:
		t.Fatalf("unknown method %s", s.method)
	}
	if e.Code != "not_implemented" {
		t.Errorf("%s %s: code = %q", s.method, s.path, e.Code)
	}
}
