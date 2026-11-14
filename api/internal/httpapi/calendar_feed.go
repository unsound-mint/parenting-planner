package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/calendar"
	"github.com/unsound-mint/parenting-planner/api/internal/demo"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const calendarFeedPath = "/api/calendar-feeds/"

var errNoCalendarFeed = Error{Code: "not_found", Message: "no such calendar feed"}

func (s *Server) calendarFeedMember(ctx context.Context, memberID uuid.UUID) (uuid.UUID, store.Member, errKind, error) {
	familyID, member, kind, err := s.actingPerson(ctx, memberID)
	if err == nil && kind == errNone && !isParentRole(member.Role) && !slices.Contains(member.Permissions, "schedule") {
		kind = errNotParent
	}
	return familyID, member, kind, err
}

func calendarFeedOut(feed store.CalendarFeed) CalendarFeed {
	scope := CalendarFeedScope(feed.Scope)
	created := feed.CreatedAt.UTC()
	out := CalendarFeed{Active: true, Scope: &scope, CreatedAt: &created}
	if feed.LastFetchedAt.Valid {
		last := feed.LastFetchedAt.Time.UTC()
		out.LastFetchedAt = &last
	}
	return out
}

func (s *Server) GetCalendarFeed(ctx context.Context, req GetCalendarFeedRequestObject) (GetCalendarFeedResponseObject, error) {
	familyID, member, kind, err := s.calendarFeedMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetCalendarFeed401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetCalendarFeed404JSONResponse(errNoMember), nil
	case kind == errNotParent:
		return GetCalendarFeed403JSONResponse(errForbidden), nil
	}
	feed, err := s.q.GetCalendarFeed(ctx, store.GetCalendarFeedParams{FamilyID: familyID, MemberID: member.ID})
	if errors.Is(err, pgx.ErrNoRows) {
		return GetCalendarFeed200JSONResponse{Active: false}, nil
	}
	if err != nil {
		return nil, err
	}
	return GetCalendarFeed200JSONResponse(calendarFeedOut(feed)), nil
}

func (s *Server) CreateCalendarFeed(ctx context.Context, req CreateCalendarFeedRequestObject) (CreateCalendarFeedResponseObject, error) {
	familyID, member, kind, err := s.calendarFeedMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateCalendarFeed401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateCalendarFeed404JSONResponse(errNoMember), nil
	case kind == errNotParent || (!isParentRole(member.Role) && req.Body.Scope != CalendarFeedScopeMine):
		return CreateCalendarFeed403JSONResponse(errForbidden), nil
	}
	token, hash, err := demo.NewToken()
	if err != nil {
		return nil, err
	}
	origin, _ := ctx.Value(calendarOriginKey{}).(string)
	if base := s.cfg.Billing.PublicBaseURL; base != "" {
		origin = strings.TrimRight(base, "/")
	}
	feed, err := s.q.SetCalendarFeed(ctx, store.SetCalendarFeedParams{
		FamilyID: familyID, MemberID: member.ID, TokenHash: hash, Scope: string(req.Body.Scope), CreatedAt: s.now(ctx),
	})
	if err != nil {
		return nil, err
	}
	link := origin + calendarFeedPath + token
	out := calendarFeedOut(feed)
	out.Url = &link
	return CreateCalendarFeed201JSONResponse(out), nil
}

func (s *Server) DeleteCalendarFeed(ctx context.Context, req DeleteCalendarFeedRequestObject) (DeleteCalendarFeedResponseObject, error) {
	familyID, member, kind, err := s.calendarFeedMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteCalendarFeed401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteCalendarFeed404JSONResponse(errNoMember), nil
	case kind == errNotParent:
		return DeleteCalendarFeed403JSONResponse(errForbidden), nil
	}
	return DeleteCalendarFeed204Response{}, s.q.DeleteCalendarFeed(ctx, store.DeleteCalendarFeedParams{FamilyID: familyID, MemberID: member.ID})
}

func (s *Server) GetCalendarFeedFile(ctx context.Context, req GetCalendarFeedFileRequestObject) (GetCalendarFeedFileResponseObject, error) {
	hash := demo.HashToken(req.Token)
	feed, err := s.q.FindCalendarFeed(ctx, hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return GetCalendarFeedFile404JSONResponse(errNoCalendarFeed), nil
	}
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, clockKey{}, feed.DemoOffsetDays)
	now := s.now(ctx)
	today := dateOf(now)
	// Share the app's permission filters and shift expansion in 31-day windows.
	var events []calendar.Event
	for from, end := today.AddDate(0, 0, -30), today.AddDate(0, 0, 181); from.Before(end); {
		to := from.AddDate(0, 0, 31)
		if end.Before(to) {
			to = end
		}
		var batch []calendar.Event
		if isParentRole(feed.Role) {
			batch, err = calendar.ListForParent(ctx, s.pool, feed.FamilyID, feed.MemberID, calendar.Scope(feed.Scope), from, to)
		} else {
			batch, err = calendar.ListForCaregiver(ctx, s.pool, feed.FamilyID, feed.MemberID, from, to)
		}
		if err != nil {
			return nil, err
		}
		events = append(events, batch...)
		from = to
	}
	// A concurrent link rotation or revocation invalidates this response too.
	rows, err := s.q.MarkCalendarFeedFetched(ctx, store.MarkCalendarFeedFetchedParams{
		FamilyID: feed.FamilyID, MemberID: feed.MemberID, TokenHash: hash,
		LastFetchedAt: pgtype.Timestamptz{Time: now, Valid: true},
	})
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return GetCalendarFeedFile404JSONResponse(errNoCalendarFeed), nil
	}
	doc := calendar.EncodeFeed(events, now)
	return calendarFeedFile{doc: doc}, nil
}

type calendarFeedFile struct{ doc string }

func (f calendarFeedFile) VisitGetCalendarFeedFileResponse(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Header().Set("Cache-Control", "private, no-store")
	_, err := w.Write([]byte(f.doc))
	return err
}

type calendarOriginKey struct{}

func calendarFeedOrigin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		scheme := "https"
		// Local development can reach the Go server directly over HTTP.
		if r.TLS == nil {
			host := (&url.URL{Host: r.Host}).Hostname()
			if host == "localhost" || host == "127.0.0.1" || host == "::1" {
				scheme = "http"
			}
		}
		origin := (&url.URL{Scheme: scheme, Host: r.Host}).String()
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), calendarOriginKey{}, origin)))
	})
}
