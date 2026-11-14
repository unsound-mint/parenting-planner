package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/unsound-mint/parenting-planner/api/internal/demo"
	"github.com/unsound-mint/parenting-planner/api/internal/portraits"
)

func (s *Server) CreateDemoSession(ctx context.Context, req CreateDemoSessionRequestObject) (CreateDemoSessionResponseObject, error) {
	familyID, token, err := demo.Start(ctx, s.pool, demo.Template(req.Body.Template), s.realToday())
	if errors.Is(err, demo.ErrUnknownTemplate) {
		return CreateDemoSession400JSONResponse{Code: "bad_template", Message: err.Error()}, nil
	}
	if err != nil {
		return nil, err
	}
	if err := s.leavePreviousDemo(ctx); err != nil {
		return nil, err
	}
	// The seed works in whole days; the hours of today up to now need the clock.
	if err := demo.SeedRecentCare(ctx, s.pool, demo.Template(req.Body.Template), familyID, s.cfg.Now()); err != nil {
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	cookie := s.sessionCookieHeader(token)
	return CreateDemoSession201JSONResponse{Body: fam, Headers: CreateDemoSession201ResponseHeaders{SetCookie: &cookie}}, nil
}

// leavePreviousDemo runs when a browser that already has a demo starts a new
// one (Reset demo, or picking another family): the new cookie replaces the
// old one, so the old family is out of reach and its uploaded photos are
// deleted now instead of waiting for the family to be deleted. Only a parent's
// session does this; an invited caregiver leaving does not touch the family.
func (s *Server) leavePreviousDemo(ctx context.Context) error {
	old, kind := managingFamily(ctx)
	if kind != errNone {
		return nil
	}
	return portraits.DropPhotos(ctx, s.q, old)
}

// sessionCookieHeader is the Set-Cookie value for a new session token.
func (s *Server) sessionCookieHeader(token string) string {
	return (&http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", HttpOnly: true,
		Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: int(demo.SessionTTL.Seconds()),
	}).String()
}

// CreateDemoTimeSkip moves the session family's demo clock a week ahead.
// Every later request reads the new offset in the session middleware.
func (s *Server) CreateDemoTimeSkip(ctx context.Context, _ CreateDemoTimeSkipRequestObject) (CreateDemoTimeSkipResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return CreateDemoTimeSkip401JSONResponse(errNoSession), nil
	case errNotParent:
		return CreateDemoTimeSkip403JSONResponse(errForbidden), nil
	}
	if err := demo.SkipWeek(ctx, s.pool, familyID, s.now(ctx)); err != nil {
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return CreateDemoTimeSkip200JSONResponse(fam), nil
}
