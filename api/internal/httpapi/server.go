// Package httpapi implements the handlers generated from ../../openapi.yaml.
// api.gen.go is generated (`make gen`). Handlers live in one file per OpenAPI
// tag (family.go, plan.go, wellbeing.go, ...) and stay thin: resolve the
// session and acting member, call the domain package, map the result.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	middleware "github.com/oapi-codegen/nethttp-middleware"
	"github.com/unsound-mint/parenting-planner/api/internal/demo"
	"github.com/unsound-mint/parenting-planner/api/internal/monitor"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const sessionCookie = "pp_session"

type Config struct {
	SecureCookies bool
	// Now is the clock; tests override it.
	Now func() time.Time
}

type Server struct {
	pool *pgxpool.Pool
	q    *store.Queries
	cfg  Config
}

var _ StrictServerInterface = (*Server)(nil)

// New returns the full HTTP handler, mounted under /api.
func New(pool *pgxpool.Pool, cfg Config) (http.Handler, error) {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	spec, err := GetSwagger()
	if err != nil {
		return nil, err
	}
	// Requests are checked against openapi.yaml (types, required fields,
	// min/max, enums) before any handler runs. Express input rules in the
	// contract, not in Go.
	validate := middleware.OapiRequestValidatorWithOptions(spec, &middleware.Options{
		Options: openapi3filter.Options{AuthenticationFunc: openapi3filter.NoopAuthenticationFunc},
		// The spec's only server is the relative path /api, so there is no host to validate.
		SilenceServersWarning: true,
		ErrorHandlerWithOpts: func(_ context.Context, err error, w http.ResponseWriter, _ *http.Request, o middleware.ErrorHandlerOpts) {
			writeError(w, o.StatusCode, "invalid_request", err.Error())
		},
	})

	s := &Server{pool: pool, q: store.New(pool), cfg: cfg}
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		},
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			slog.Error("handler failed", "method", r.Method, "path", r.URL.Path, "err", err)
			monitor.Report(r, err)
			writeError(w, http.StatusInternalServerError, "internal", "something went wrong")
		},
	})
	// Middlewares run last-to-first: validate, then resolve the session.
	return recoverPanics(HandlerWithOptions(strict, StdHTTPServerOptions{
		BaseURL:     "/api",
		Middlewares: []MiddlewareFunc{s.session, validate},
	})), nil
}

// recoverPanics turns a panic in a handler into a logged and reported 500
// instead of a dropped connection.
func recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}
			if rec == http.ErrAbortHandler {
				panic(rec)
			}
			slog.Error("handler panicked", "method", r.Method, "path", r.URL.Path, "panic", rec)
			monitor.ReportPanic(r, rec)
			writeError(w, http.StatusInternalServerError, "internal", "something went wrong")
		}()
		next.ServeHTTP(w, r)
	})
}

// now is the session family's clock: the real time plus the days its demo
// clock was skipped ahead (createDemoTimeSkip). Use it, not s.cfg.Now(), for
// anything family-scoped, so plans, weeks and timelines move with the skip.
func (s *Server) now(ctx context.Context) time.Time {
	days, _ := ctx.Value(clockKey{}).(int32)
	return s.cfg.Now().AddDate(0, 0, int(days))
}

// today is the date used for plans, on the session family's clock. Families
// are in the US; UTC is close enough until families store their own time zone.
func (s *Server) today(ctx context.Context) time.Time {
	return dateOf(s.now(ctx))
}

// realToday ignores the demo clock. Seeding a new demo family uses it, since
// the visitor's old session (with its skip) may still be on the request.
func (s *Server) realToday() time.Time {
	return dateOf(s.cfg.Now())
}

func dateOf(t time.Time) time.Time {
	y, m, d := t.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

type ctxKey struct{}

// clockKey holds the session family's demo clock offset in days.
type clockKey struct{}

// session resolves the cookie to a family id and its demo clock offset and
// stores both in the context.
func (s *Server) session(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
			if row, err := s.q.GetSessionFamily(r.Context(), demo.HashToken(c.Value)); err == nil {
				ctx := context.WithValue(r.Context(), ctxKey{}, row.FamilyID)
				r = r.WithContext(context.WithValue(ctx, clockKey{}, row.DemoOffsetDays))
			} else if !errors.Is(err, pgx.ErrNoRows) {
				slog.Error("session lookup", "err", err)
			}
		}
		next.ServeHTTP(w, r)
	})
}

// Standard error bodies. Use these instead of writing new messages per handler.
var (
	errNoSession = Error{Code: "no_session", Message: "start a demo first"}
	errNoMember  = Error{Code: "not_found", Message: "no such parent in this family"}
	// errForbidden is for a person who is in the family but may not do this.
	errForbidden = Error{Code: "forbidden", Message: "this person may not do that"}

	errNoBooking         = Error{Code: "not_found", Message: "no such session for this parent"}
	errSlotTaken         = Error{Code: "slot_taken", Message: "this time is no longer open"}
	errSessionNotStarted = Error{Code: "session_not_started", Message: "you can write a note once the session has started"}
	errNoteExists        = Error{Code: "note_exists", Message: "you already wrote a note for this session"}
	errEmptyNote         = Error{Code: "invalid_request", Message: "the note is empty"}
	errNoPlanItem        = Error{Code: "not_found", Message: "this item is not on this parent's plan"}

	errNoVoiceNote       = Error{Code: "not_found", Message: "no such voice note"}
	errVoiceNoteType     = Error{Code: "invalid_request", Message: "record as audio/webm, audio/mp4 or audio/ogg"}
	errVoiceNoteEmpty    = Error{Code: "invalid_request", Message: "the recording is empty"}
	errVoiceNoteTooLarge = Error{Code: "too_large", Message: "a voice note can be at most 1 MB"}
)

// errKind tells a handler which typed error response to return.
type errKind int

const (
	errNone errKind = iota
	errUnauthorized
	errNotFound
)

// actingMember resolves the session's family and checks that memberID is a
// parent in it. Every /members/{memberId}/... handler starts with this.
func (s *Server) actingMember(ctx context.Context, memberID uuid.UUID) (familyID uuid.UUID, m store.Member, kind errKind, err error) {
	familyID, ok := ctx.Value(ctxKey{}).(uuid.UUID)
	if !ok {
		return uuid.Nil, store.Member{}, errUnauthorized, nil
	}
	m, err = s.q.GetMember(ctx, store.GetMemberParams{ID: memberID, FamilyID: familyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return familyID, m, errNotFound, nil
	}
	return familyID, m, errNone, err
}

func familyFrom(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(ctxKey{}).(uuid.UUID)
	return id, ok
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Error{Code: code, Message: msg})
}

func (s *Server) Healthz(ctx context.Context, _ HealthzRequestObject) (HealthzResponseObject, error) {
	if err := s.pool.Ping(ctx); err != nil {
		return nil, err
	}
	return Healthz200JSONResponse{Status: "ok"}, nil
}
