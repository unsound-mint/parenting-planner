package monitor

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
)

const (
	memberID = "3f0c6a8e-1b2d-4c5e-9f00-123456789abc"
	email    = "maria.lopez@example.com"
	note     = "Cried in the car after the scan, scared about the results"
	token    = "secret-session-token"
)

// leaks fails the test if any personal value appears anywhere in the event.
func leaks(t *testing.T, e *sentry.Event) {
	t.Helper()
	b, err := json.Marshal(e)
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	for _, bad := range []string{memberID, email, note, token, "pp_session", "203.0.113.7", "week=12", "Cookie", "X-Forwarded-For"} {
		if strings.Contains(s, bad) {
			t.Errorf("event still contains %q:\n%s", bad, s)
		}
	}
}

func TestScrubRemovesPersonalData(t *testing.T) {
	body := `{"note":"` + note + `","email":"` + email + `"}`
	e := &sentry.Event{
		Message: "insert failed for " + email,
		Request: &sentry.Request{
			URL:         "https://parenting.example/api/members/" + memberID + "/diary?week=12",
			Method:      "POST",
			Data:        body,
			QueryString: "week=12",
			Cookies:     "pp_session=" + token,
			Headers: map[string]string{
				"Cookie":          "pp_session=" + token,
				"User-Agent":      "Mozilla/5.0",
				"X-Forwarded-For": "203.0.113.7",
			},
			Env: map[string]string{"REMOTE_ADDR": "203.0.113.7"},
		},
		User:        sentry.User{ID: memberID, Email: email, IPAddress: "203.0.113.7"},
		Breadcrumbs: []*sentry.Breadcrumb{{Message: "request body", Data: map[string]any{"body": body}}},
		Tags:        map[string]string{"member": memberID},
		Contexts:    map[string]sentry.Context{"family": {"email": email}, "runtime": {"name": "go"}},
		Exception:   []sentry.Exception{{Type: "*errors.errorString", Value: "member " + memberID + " (" + email + ") not saved"}},
	}

	got := Scrub(e)
	leaks(t, got)

	if got.Request.Method != "POST" || got.Request.URL != "/api/members/{id}/diary" {
		t.Errorf("request = %s %s, want POST /api/members/{id}/diary", got.Request.Method, got.Request.URL)
	}
	if got.Request.Headers["User-Agent"] != "Mozilla/5.0" {
		t.Errorf("user agent dropped: %v", got.Request.Headers)
	}
	if got.Exception[0].Value != "member {id} ({email}) not saved" {
		t.Errorf("exception = %q", got.Exception[0].Value)
	}
	if _, ok := got.Contexts["runtime"]; !ok {
		t.Error("runtime context dropped")
	}
}

func TestMaskPath(t *testing.T) {
	for in, want := range map[string]string{
		"/api/plan":                        "/api/plan",
		"http://h/api/members/" + memberID: "/api/members/{id}",
		"http://h?x=" + email:              "/",
		"/api/x#" + email:                  "/api/x",
	} {
		if got := maskPath(in); got != want {
			t.Errorf("maskPath(%q) = %q, want %q", in, got, want)
		}
	}
}

// captureTransport keeps events in memory instead of sending them.
type captureTransport struct {
	mu     sync.Mutex
	events []*sentry.Event
}

func (c *captureTransport) Configure(sentry.ClientOptions) {}
func (c *captureTransport) SendEvent(e *sentry.Event) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, e)
}
func (c *captureTransport) Flush(time.Duration) bool              { return true }
func (c *captureTransport) FlushWithContext(context.Context) bool { return true }
func (c *captureTransport) Close()                                {}

// TestReportSendsOnlyScrubbedData runs a real request through Report with
// the same options Init uses, and checks what reaches the transport.
func TestReportSendsOnlyScrubbedData(t *testing.T) {
	tr := &captureTransport{}
	client, err := sentry.NewClient(options("https://key@o0.ingest.example/1", "test", tr))
	if err != nil {
		t.Fatal(err)
	}
	prev := sentry.CurrentHub().Client()
	sentry.CurrentHub().BindClient(client)
	t.Cleanup(func() { sentry.CurrentHub().BindClient(prev) })

	r := httptest.NewRequest("POST", "/api/members/"+memberID+"/diary?week=12",
		strings.NewReader(`{"note":"`+note+`","email":"`+email+`"}`))
	r.Header.Set("Cookie", "pp_session="+token)
	r.Header.Set("User-Agent", "Mozilla/5.0")
	r.Header.Set("X-Forwarded-For", "203.0.113.7")
	sentry.AddBreadcrumb(&sentry.Breadcrumb{Message: note})

	Report(r, errors.New("insert failed"))
	ReportPanic(r, "boom for "+email)

	if len(tr.events) != 2 {
		t.Fatalf("got %d events, want 2", len(tr.events))
	}
	for _, e := range tr.events {
		leaks(t, e)
		if e.Request == nil || e.Request.URL != "/api/members/{id}/diary" {
			t.Errorf("request = %+v", e.Request)
		}
	}
}

func TestInitWithoutDSNIsANoop(t *testing.T) {
	flush, err := Init("", "test")
	if err != nil {
		t.Fatal(err)
	}
	flush()
}
