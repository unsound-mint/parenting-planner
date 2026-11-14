package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/carelog"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errNoCareLogAccess   = Error{Code: "forbidden", Message: "you do not have access to the care log"}
	errBabyNotHome       = Error{Code: "no_child", Message: "the baby is not home yet"}
	errBadChild          = Error{Code: "bad_child", Message: "no such child in this family"}
	errCareLogDetail     = Error{Code: "missing_detail", Message: "a feed needs feedMethod and a diaper needs diaper"}
	errCareLogTimes      = Error{Code: "bad_times", Message: "endedAt must not be before startedAt"}
	errHandoffInvalid    = Error{Code: "handoff_invalid", Message: "hand over to another person with care log access, one handoff at a time"}
	errNoHandoff         = Error{Code: "not_found", Message: "no such handoff"}
	errNotRecipient      = Error{Code: "not_handoff_recipient", Message: "only the person it is handed to can accept"}
	errHandoffNotPending = Error{Code: "handoff_not_pending", Message: "this handoff was already accepted"}
)

func carePerson(m store.Member) carelog.Person {
	return carelog.Person{ID: m.ID, Role: m.Role, Permissions: m.Permissions}
}

func careEntryOut(e store.CareLogEntry) CareLogEntry {
	out := CareLogEntry{Id: e.ID, ChildId: e.ChildID, AuthorId: e.AuthorMemberID, Kind: CareLogKind(e.Kind), StartedAt: e.StartedAt, Note: e.Note, CreatedAt: e.CreatedAt}
	if e.EndedAt.Valid {
		out.EndedAt = &e.EndedAt.Time
	}
	if e.FeedMethod != nil {
		m := FeedMethod(*e.FeedMethod)
		out.FeedMethod = &m
	}
	if e.AmountMl.Valid {
		n := int(e.AmountMl.Int16)
		out.AmountMl = &n
	}
	if e.Diaper != nil {
		d := DiaperContent(*e.Diaper)
		out.Diaper = &d
	}
	return out
}

func careSummaryOut(s carelog.Summary) CareSummary {
	var out CareSummary
	conv := func(e *store.CareLogEntry) *CareLogEntry {
		if e == nil {
			return nil
		}
		v := careEntryOut(*e)
		return &v
	}
	out.LastFeed, out.LastSleep, out.LastDiaper = conv(s.LastFeed), conv(s.LastSleep), conv(s.LastDiaper)
	if s.OnDuty != nil {
		out.OnDuty = &OnDuty{MemberId: s.OnDuty.MemberID, Since: s.OnDuty.Since, Via: OnDutyVia(s.OnDuty.Via)}
	}
	return out
}

func handoffOut(h store.Handoff, sum carelog.Summary) Handoff {
	out := Handoff{
		Id: h.ID, FromMemberId: h.FromMemberID, ToMemberId: h.ToMemberID, Note: h.Note, Status: HandoffStatus(h.Status),
		CreatedAt: h.CreatedAt, CareSummary: careSummaryOut(sum),
	}
	if h.ShiftID.Valid {
		id := h.ShiftID.UUID
		out.ShiftId = &id
	}
	if h.AcceptedAt.Valid {
		out.AcceptedAt = &h.AcceptedAt.Time
	}
	return out
}

func (s *Server) CreateCareLogEntry(ctx context.Context, req CreateCareLogEntryRequestObject) (CreateCareLogEntryResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateCareLogEntry401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateCareLogEntry404JSONResponse(errNoMember), nil
	case !carePerson(m).CanUse():
		return CreateCareLogEntry403JSONResponse(errNoCareLogAccess), nil
	}
	b := req.Body
	in := carelog.NewEntry{ChildID: b.ChildId, Kind: string(b.Kind), StartedAt: b.StartedAt, EndedAt: b.EndedAt, Note: b.Note}
	if b.FeedMethod != nil {
		v := string(*b.FeedMethod)
		in.FeedMethod = &v
	}
	if b.Diaper != nil {
		v := string(*b.Diaper)
		in.Diaper = &v
	}
	if b.AmountMl != nil {
		v := int16(*b.AmountMl)
		in.AmountMl = &v
	}
	e, err := carelog.CreateEntry(ctx, s.pool, familyID, carePerson(m), in, s.now(ctx))
	switch {
	case errors.Is(err, carelog.ErrNoChild):
		return CreateCareLogEntry409JSONResponse(errBabyNotHome), nil
	case errors.Is(err, carelog.ErrBadChild):
		return CreateCareLogEntry400JSONResponse(errBadChild), nil
	case errors.Is(err, carelog.ErrMissingDetail):
		return CreateCareLogEntry400JSONResponse(errCareLogDetail), nil
	case errors.Is(err, carelog.ErrBadTimes):
		return CreateCareLogEntry400JSONResponse(errCareLogTimes), nil
	case err != nil:
		return nil, err
	}
	return CreateCareLogEntry201JSONResponse(careEntryOut(e)), nil
}

func (s *Server) ListCareLogEntries(ctx context.Context, req ListCareLogEntriesRequestObject) (ListCareLogEntriesResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListCareLogEntries401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListCareLogEntries404JSONResponse(errNoMember), nil
	case !carePerson(m).CanUse():
		return ListCareLogEntries403JSONResponse(errNoCareLogAccess), nil
	}
	var k *string
	if req.Params.Kind != nil {
		v := string(*req.Params.Kind)
		k = &v
	}
	rows, sum, err := carelog.ListEntries(ctx, s.pool, familyID, carePerson(m), k, s.now(ctx))
	if err != nil {
		return nil, err
	}
	items := make([]CareLogEntry, 0, len(rows))
	for _, r := range rows {
		items = append(items, careEntryOut(r))
	}
	return ListCareLogEntries200JSONResponse{Items: items, Latest: careSummaryOut(sum)}, nil
}

func (s *Server) CreateHandoff(ctx context.Context, req CreateHandoffRequestObject) (CreateHandoffResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateHandoff401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateHandoff404JSONResponse(errNoMember), nil
	case !carePerson(m).CanUse():
		return CreateHandoff403JSONResponse(errNoCareLogAccess), nil
	}
	b := req.Body
	h, err := carelog.CreateHandoff(ctx, s.pool, familyID, carePerson(m), b.ToMemberId, b.Note, b.ShiftId, s.now(ctx))
	switch {
	case errors.Is(err, carelog.ErrHandoffInvalid):
		return CreateHandoff409JSONResponse(errHandoffInvalid), nil
	case err != nil:
		return nil, err
	}
	sum, err := s.careSummary(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return CreateHandoff201JSONResponse(handoffOut(h, sum)), nil
}

// careSummary is read after a write so the response shows the latest feed, sleep and diaper.
func (s *Server) careSummary(ctx context.Context, familyID uuid.UUID) (carelog.Summary, error) {
	return carelog.LatestSummary(ctx, s.pool, familyID, s.now(ctx))
}

func (s *Server) ListHandoffs(ctx context.Context, req ListHandoffsRequestObject) (ListHandoffsResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListHandoffs401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListHandoffs404JSONResponse(errNoMember), nil
	case !carePerson(m).CanUse():
		return ListHandoffs403JSONResponse(errNoCareLogAccess), nil
	}
	rows, sum, err := carelog.ListHandoffs(ctx, s.pool, familyID, carePerson(m), s.now(ctx))
	if err != nil {
		return nil, err
	}
	items := make([]Handoff, 0, len(rows))
	for _, r := range rows {
		items = append(items, handoffOut(r, sum))
	}
	return ListHandoffs200JSONResponse{Items: items}, nil
}

func (s *Server) AcceptHandoff(ctx context.Context, req AcceptHandoffRequestObject) (AcceptHandoffResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return AcceptHandoff401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return AcceptHandoff404JSONResponse(errNoMember), nil
	}
	h, sum, err := carelog.AcceptHandoff(ctx, s.pool, familyID, carePerson(m), req.HandoffId, s.now(ctx))
	switch {
	case errors.Is(err, carelog.ErrNoHandoff):
		return AcceptHandoff404JSONResponse(errNoHandoff), nil
	case errors.Is(err, carelog.ErrNotRecipient):
		return AcceptHandoff409JSONResponse(errNotRecipient), nil
	case errors.Is(err, carelog.ErrHandoffNotPending):
		return AcceptHandoff409JSONResponse(errHandoffNotPending), nil
	case err != nil:
		return nil, err
	}
	return AcceptHandoff200JSONResponse(handoffOut(h, sum)), nil
}
