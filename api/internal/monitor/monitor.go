// Package monitor reports unexpected server errors (500s and panics) to
// Sentry, with personal data scrubbed before anything leaves the process.
//
// It is off unless SENTRY_DSN is set: Init returns without starting a client,
// and Report and Recover then only do the local work (no network). Tests, CI
// and local dev therefore never send anything.
//
// What may be sent is decided by Scrub, which runs as BeforeSend on every
// event: the HTTP method, the path with ids replaced by {id}, the user agent,
// the error text with ids and email addresses masked, and the stack trace.
// Bodies, cookies, query strings, other headers, user and IP never leave.
package monitor

import (
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
)

// Init starts the Sentry client when dsn is non-empty. The returned function
// flushes queued events and is safe to call either way.
func Init(dsn, environment string) (flush func(), err error) {
	if dsn == "" {
		return func() {}, nil
	}
	err = sentry.Init(options(dsn, environment, nil))
	if err != nil {
		return func() {}, err
	}
	return func() { sentry.Flush(2 * time.Second) }, nil
}

// options are the client settings; the transport is swapped in tests.
func options(dsn, environment string, transport sentry.Transport) sentry.ClientOptions {
	return sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      environment,
		ServerName:       "api",
		SendDefaultPII:   false,
		AttachStacktrace: true,
		MaxBreadcrumbs:   -1, // no breadcrumbs at all: they could carry payloads
		BeforeBreadcrumb: func(*sentry.Breadcrumb, *sentry.BreadcrumbHint) *sentry.Breadcrumb { return nil },
		BeforeSend:       func(e *sentry.Event, _ *sentry.EventHint) *sentry.Event { return Scrub(e) },
		Transport:        transport,
	}
}

// Report sends err, raised while serving r, as an error event. A no-op
// without a client.
func Report(r *http.Request, err error) {
	withRequest(r).CaptureException(err)
}

// ReportPanic sends a recovered panic value raised while serving r.
func ReportPanic(r *http.Request, recovered any) {
	withRequest(r).RecoverWithContext(r.Context(), recovered)
}

// withRequest returns a hub whose events carry only the method, path and
// user agent of r. It does not use Scope.SetRequest, which would buffer the
// body and copy every header; Scrub then trims what is left.
func withRequest(r *http.Request) *sentry.Hub {
	hub := sentry.CurrentHub().Clone()
	req := &sentry.Request{
		Method:  r.Method,
		URL:     r.URL.Path,
		Headers: map[string]string{"User-Agent": r.UserAgent()},
	}
	hub.Scope().AddEventProcessor(func(e *sentry.Event, _ *sentry.EventHint) *sentry.Event {
		e.Request = req
		return e
	})
	return hub
}

var (
	uuidRe  = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	emailRe = regexp.MustCompile(`[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-zA-Z]{2,}`)
)

// allowedHeaders are the only request headers kept on an event.
var allowedHeaders = []string{"User-Agent"}

// allowedContexts are the SDK's own runtime contexts; nothing about the
// family or the request.
var allowedContexts = map[string]bool{"runtime": true, "os": true, "device": true, "trace": true}

// Scrub removes personal data from an event. It is the BeforeSend hook and
// is exported so it can be tested without a Sentry client.
func Scrub(e *sentry.Event) *sentry.Event {
	if e == nil {
		return nil
	}
	if e.Request != nil {
		req := &sentry.Request{Method: e.Request.Method, URL: maskPath(e.Request.URL)}
		for _, h := range allowedHeaders {
			if v, ok := e.Request.Headers[h]; ok {
				if req.Headers == nil {
					req.Headers = map[string]string{}
				}
				req.Headers[h] = v
			}
		}
		e.Request = req
		e.Transaction = req.Method + " " + req.URL
	}
	e.User = sentry.User{}
	e.Breadcrumbs = nil
	e.Attachments = nil
	e.Tags = nil
	for k := range e.Contexts {
		if !allowedContexts[k] {
			delete(e.Contexts, k)
		}
	}
	e.Message = maskText(e.Message)
	for i := range e.Exception {
		e.Exception[i].Value = maskText(e.Exception[i].Value)
	}
	return e
}

// maskPath keeps only the path of a URL, with ids replaced by {id}. It cuts
// the string instead of parsing it, so even a malformed URL cannot carry its
// query string through.
func maskPath(raw string) string {
	s, _, _ := strings.Cut(raw, "?")
	s, _, _ = strings.Cut(s, "#")
	if _, rest, ok := strings.Cut(s, "://"); ok {
		s = "/"
		if i := strings.Index(rest, "/"); i >= 0 {
			s = rest[i:]
		}
	}
	if strings.HasPrefix(s, "/api/calendar-feeds/") {
		return "/api/calendar-feeds/{token}"
	}
	return uuidRe.ReplaceAllString(s, "{id}")
}

func maskText(s string) string {
	s = uuidRe.ReplaceAllString(s, "{id}")
	return emailRe.ReplaceAllString(s, "{email}")
}
