package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/unsound-mint/parenting-planner/api/internal/demo"
)

func (s *Server) CreateDemoSession(ctx context.Context, req CreateDemoSessionRequestObject) (CreateDemoSessionResponseObject, error) {
	familyID, token, err := demo.Start(ctx, s.pool, demo.Template(req.Body.Template), s.today())
	if errors.Is(err, demo.ErrUnknownTemplate) {
		return CreateDemoSession400JSONResponse{Code: "bad_template", Message: err.Error()}, nil
	}
	if err != nil {
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	cookie := s.sessionCookieHeader(token)
	return CreateDemoSession201JSONResponse{Body: fam, Headers: CreateDemoSession201ResponseHeaders{SetCookie: &cookie}}, nil
}

// sessionCookieHeader is the Set-Cookie value for a new session token.
func (s *Server) sessionCookieHeader(token string) string {
	return (&http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", HttpOnly: true,
		Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: int(demo.SessionTTL.Seconds()),
	}).String()
}

// CreateDemoTimeSkip is a stub until the demo clock is stored (#325).
func (s *Server) CreateDemoTimeSkip(_ context.Context, _ CreateDemoTimeSkipRequestObject) (CreateDemoTimeSkipResponseObject, error) {
	return CreateDemoTimeSkip501JSONResponse(Error{Code: "not_implemented", Message: "skipping ahead is not available yet"}), nil
}
