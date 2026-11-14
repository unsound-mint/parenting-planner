package httpapi_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// stubCall is one request to an endpoint whose handler is still a 501 stub.
// The body must be valid for the contract: the validator runs first and
// would answer 400 instead.
type stubCall struct {
	method string // GET, POST, PUT, PATCH, DELETE, WEBHOOK (POST with a Stripe-Signature header) or AUDIO (POST of raw audio/webm)
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
	case "PUT":
		c.Put(s.path, s.body, http.StatusNotImplemented, &e)
	case "PATCH":
		c.Patch(s.path, s.body, http.StatusNotImplemented, &e)
	case "DELETE", "AUDIO":
		method, ct, body := http.MethodDelete, "", ""
		if s.method == "AUDIO" {
			method, ct, body = http.MethodPost, "audio/webm", "fake opus frames"
		}
		code, raw := c.Raw(method, s.path, ct, strings.NewReader(body))
		if code != http.StatusNotImplemented {
			t.Fatalf("%s %s: status %d, want 501; body: %s", s.method, s.path, code, raw)
		}
		if err := json.Unmarshal(raw, &e); err != nil {
			t.Fatal(err)
		}
	case "WEBHOOK":
		c.PostWithHeaders(s.path, map[string]string{"Stripe-Signature": "t=1,v1=stub"}, s.body, http.StatusNotImplemented, &e)
	default:
		t.Fatalf("unknown method %s", s.method)
	}
	if e.Code != "not_implemented" {
		t.Errorf("%s %s: code = %q", s.method, s.path, e.Code)
	}
}
