// Package httpapi implements the handlers generated from ../../openapi.yaml.
// api.gen.go is generated (`make gen`); handlers live in this and sibling files.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/demo"
	"github.com/unsound-mint/parenting-planner/api/internal/plan"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
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
func New(pool *pgxpool.Pool, cfg Config) http.Handler {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	s := &Server{pool: pool, q: store.New(pool), cfg: cfg}
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		},
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			slog.Error("handler failed", "path", r.URL.Path, "err", err)
			writeError(w, http.StatusInternalServerError, "internal", "something went wrong")
		},
	})
	return HandlerWithOptions(strict, StdHTTPServerOptions{
		BaseURL:     "/api",
		Middlewares: []MiddlewareFunc{s.session},
	})
}

// today is the date used for plans. Families are in the US; UTC is close
// enough until families store their own time zone.
func (s *Server) today() time.Time {
	y, m, d := s.cfg.Now().UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

type ctxKey struct{}

// session resolves the cookie to a family id. Handlers that need a family
// call familyFrom and return 401 when it is missing.
func (s *Server) session(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
			if id, err := s.q.GetSessionFamily(r.Context(), demo.HashToken(c.Value)); err == nil {
				r = r.WithContext(context.WithValue(r.Context(), ctxKey{}, id))
			} else if !errors.Is(err, pgx.ErrNoRows) {
				slog.Error("session lookup", "err", err)
			}
		}
		next.ServeHTTP(w, r)
	})
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

var errNoSession = ErrorJSONResponse{Code: "no_session", Message: "start a demo first"}

func (s *Server) Healthz(ctx context.Context, _ HealthzRequestObject) (HealthzResponseObject, error) {
	if err := s.pool.Ping(ctx); err != nil {
		return nil, err
	}
	return Healthz200JSONResponse{Status: "ok"}, nil
}

func (s *Server) CreateDemoSession(ctx context.Context, req CreateDemoSessionRequestObject) (CreateDemoSessionResponseObject, error) {
	familyID, token, err := demo.Start(ctx, s.pool, demo.Template(req.Body.Template), s.today())
	if err != nil {
		return CreateDemoSession400JSONResponse{ErrorJSONResponse{Code: "bad_template", Message: err.Error()}}, nil
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	cookie := (&http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", HttpOnly: true,
		Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: int(demo.SessionTTL.Seconds()),
	}).String()
	return CreateDemoSession201JSONResponse{Body: fam, Headers: CreateDemoSession201ResponseHeaders{SetCookie: &cookie}}, nil
}

func (s *Server) GetFamily(ctx context.Context, _ GetFamilyRequestObject) (GetFamilyResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return GetFamily401JSONResponse{errNoSession}, nil
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return GetFamily200JSONResponse(fam), nil
}

func (s *Server) GetMemberPlan(ctx context.Context, req GetMemberPlanRequestObject) (GetMemberPlanResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return GetMemberPlan401JSONResponse{errNoSession}, nil
	}
	items, err := plan.ForMember(ctx, s.q, familyID, req.MemberId, s.today())
	if errors.Is(err, pgx.ErrNoRows) {
		return GetMemberPlan404JSONResponse{Code: "not_found", Message: "no such parent in this family"}, nil
	}
	if err != nil {
		return nil, err
	}
	out := Plan{MemberId: req.MemberId, GeneratedAt: s.cfg.Now().UTC(), Items: make([]PlanItem, 0, len(items))}
	for _, it := range items {
		pi := PlanItem{
			RuleId: it.RuleID, Title: it.Title, Detail: it.Detail, Reason: it.Reason,
			Status: PlanItemStatus(it.Status), Category: PlanCategory(it.Category),
			Source: Source{Title: it.Source.Title, Url: it.Source.URL, CheckedAt: openapi_types.Date{Time: it.Source.CheckedAt}},
		}
		if it.DueBy != nil {
			pi.DueBy = &openapi_types.Date{Time: *it.DueBy}
		}
		out.Items = append(out.Items, pi)
	}
	return GetMemberPlan200JSONResponse(out), nil
}

func (s *Server) loadFamily(ctx context.Context, id uuid.UUID) (Family, error) {
	fam, err := s.q.GetFamily(ctx, id)
	if err != nil {
		return Family{}, err
	}
	members, err := s.q.ListMembers(ctx, id)
	if err != nil {
		return Family{}, err
	}
	children, err := s.q.ListChildren(ctx, id)
	if err != nil {
		return Family{}, err
	}
	today := s.today()
	out := Family{
		Id: fam.ID, Template: DemoTemplate(fam.Template), Stage: Stage(fam.Stage),
		Parents: make([]Parent, 0, len(members)), Children: make([]Child, 0, len(children)),
	}
	if fam.DueDate != nil {
		out.DueDate = &openapi_types.Date{Time: *fam.DueDate}
		f := rules.Facts{Today: today, Stage: fam.Stage, DueDate: fam.DueDate}
		if w, ok := f.GestationalWeek(); ok {
			out.GestationalWeek = &w
		}
	}
	for _, m := range members {
		out.Parents = append(out.Parents, Parent{Id: m.ID, Role: ParentRole(m.Role), DisplayName: m.DisplayName})
	}
	for _, c := range children {
		out.Children = append(out.Children, Child{Id: c.ID, Name: c.Name, BirthDate: openapi_types.Date{Time: c.BirthDate}, AgeMonths: monthsBetween(c.BirthDate, today)})
	}
	return out, nil
}

func monthsBetween(from, to time.Time) int {
	m := (to.Year()-from.Year())*12 + int(to.Month()-from.Month())
	if to.Day() < from.Day() {
		m--
	}
	return max(m, 0)
}
