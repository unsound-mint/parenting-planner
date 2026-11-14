package httpapi

import (
	"context"
	"errors"

	"github.com/unsound-mint/parenting-planner/api/internal/virtualbaby"
)

// Virtual Baby is parents only: actingMember answers 404 for a caregiver.
// Sessions are the family's; the acting parent is recorded as the one who
// started a session or handled a moment.

var (
	errVirtualBabyActive = Error{Code: "session_active", Message: "finish the current session before starting another"}
	errNoVirtualBaby     = Error{Code: "not_found", Message: "no such session in this family"}
	errMomentTaken       = Error{Code: "moment_taken", Message: "this moment was already handled or the session is over"}
	errUnknownBabyChoice = Error{Code: "unknown_choice", Message: "that choice is not offered for this moment"}
)

func (s *Server) GetVirtualBaby(ctx context.Context, req GetVirtualBabyRequestObject) (GetVirtualBabyResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetVirtualBaby401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetVirtualBaby404JSONResponse(errNoMember), nil
	}
	sessions, stickers, err := virtualbaby.List(ctx, s.pool, familyID)
	if err != nil {
		return nil, err
	}
	out := VirtualBaby{Items: make([]VirtualBabySession, 0, len(sessions)), Stickers: make([]VirtualBabySticker, 0, len(stickers))}
	for _, v := range sessions {
		out.Items = append(out.Items, virtualBabySessionOut(v))
	}
	for _, st := range stickers {
		out.Stickers = append(out.Stickers, VirtualBabySticker{Id: VirtualBabyStickerId(st.ID), Title: st.Title, EarnedAt: st.EarnedAt.UTC(), EarnedBy: st.EarnedBy})
	}
	return GetVirtualBaby200JSONResponse(out), nil
}

func (s *Server) CreateVirtualBabySession(ctx context.Context, req CreateVirtualBabySessionRequestObject) (CreateVirtualBabySessionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateVirtualBabySession401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateVirtualBabySession404JSONResponse(errNoMember), nil
	}
	v, err := virtualbaby.Start(ctx, s.pool, familyID, req.MemberId, virtualbaby.Mode(req.Body.Mode), s.now(ctx))
	switch {
	case errors.Is(err, virtualbaby.ErrActive):
		return CreateVirtualBabySession409JSONResponse(errVirtualBabyActive), nil
	case errors.Is(err, virtualbaby.ErrUnknownMode):
		return CreateVirtualBabySession400JSONResponse(Error{Code: "invalid_request", Message: "unknown mode"}), nil
	case err != nil:
		return nil, err
	}
	return CreateVirtualBabySession201JSONResponse(virtualBabySessionOut(v)), nil
}

func (s *Server) UpdateVirtualBabySession(ctx context.Context, req UpdateVirtualBabySessionRequestObject) (UpdateVirtualBabySessionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateVirtualBabySession401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateVirtualBabySession404JSONResponse(errNoMember), nil
	}
	v, err := virtualbaby.Finish(ctx, s.pool, familyID, req.SessionId, s.now(ctx))
	switch {
	case errors.Is(err, virtualbaby.ErrNoSession):
		return UpdateVirtualBabySession404JSONResponse(errNoVirtualBaby), nil
	case err != nil:
		return nil, err
	}
	return UpdateVirtualBabySession200JSONResponse(virtualBabySessionOut(v)), nil
}

func (s *Server) CreateVirtualBabyMoment(ctx context.Context, req CreateVirtualBabyMomentRequestObject) (CreateVirtualBabyMomentResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateVirtualBabyMoment401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateVirtualBabyMoment404JSONResponse(errNoMember), nil
	}
	m, v, err := virtualbaby.Respond(ctx, s.pool, familyID, req.SessionId, req.MemberId, req.Body.Seq, req.Body.ChoiceId, s.now(ctx))
	switch {
	case errors.Is(err, virtualbaby.ErrNoSession):
		return CreateVirtualBabyMoment404JSONResponse(errNoVirtualBaby), nil
	case errors.Is(err, virtualbaby.ErrTaken):
		return CreateVirtualBabyMoment409JSONResponse(errMomentTaken), nil
	case errors.Is(err, virtualbaby.ErrUnknownChoice):
		return CreateVirtualBabyMoment400JSONResponse(errUnknownBabyChoice), nil
	case err != nil:
		return nil, err
	}
	return CreateVirtualBabyMoment201JSONResponse(VirtualBabyMomentResult{Moment: virtualBabyMomentOut(m), Session: virtualBabySessionOut(v)}), nil
}

func virtualBabySessionOut(v virtualbaby.Session) VirtualBabySession {
	out := VirtualBabySession{
		Id: v.ID, Mode: VirtualBabyMode(v.Mode), StartedAt: v.StartedAt.UTC(), StartedBy: v.StartedBy,
		StartClock: v.Plan.StartClock, LengthMinutes: v.Plan.Length, MomentCount: len(v.Plan.Slots),
		Moments:   make([]VirtualBabyMoment, 0, len(v.Moments)),
		Needs:     make([]VirtualBabyNeedClock, 0, len(v.Needs)),
		Practised: make([]VirtualBabyPractised, 0, len(v.Practised)),
	}
	if v.FinishedAt != nil {
		t := v.FinishedAt.UTC()
		out.FinishedAt = &t
	}
	for _, m := range v.Moments {
		out.Moments = append(out.Moments, virtualBabyMomentOut(m))
	}
	if n := v.Next; n != nil {
		p := VirtualBabyPrompt{Seq: n.Seq, Minute: n.Minute, Need: VirtualBabyNeed(n.Scenario.Need), ScenarioId: n.Scenario.ID, Title: n.Scenario.Title, Cue: n.Scenario.Cue}
		for _, c := range n.Scenario.Choices {
			p.Choices = append(p.Choices, VirtualBabyChoice{Id: c.ID, Label: c.Label, Action: VirtualBabyAction(c.Action)})
		}
		out.Next = &p
	}
	for _, n := range v.Needs {
		out.Needs = append(out.Needs, VirtualBabyNeedClock{Need: VirtualBabyNeed(n.Need), Since: n.Since, Every: n.Every})
	}
	for _, p := range v.Practised {
		row := VirtualBabyPractised{Need: VirtualBabyNeed(p.Need), ByMember: make([]VirtualBabyCount, 0, len(p.ByMember))}
		for _, c := range p.ByMember {
			row.ByMember = append(row.ByMember, VirtualBabyCount{MemberId: c.MemberID, Count: c.Count})
		}
		out.Practised = append(out.Practised, row)
	}
	return out
}

func virtualBabyMomentOut(m virtualbaby.Moment) VirtualBabyMoment {
	f := m.Choice.Feedback
	return VirtualBabyMoment{
		Seq: m.Seq, Minute: m.Minute, Need: VirtualBabyNeed(m.Scenario.Need), ScenarioId: m.Scenario.ID, Title: m.Scenario.Title,
		ChoiceId: m.Choice.ID, ChoiceLabel: m.Choice.Label, Action: VirtualBabyAction(m.Choice.Action),
		HandledBy: m.HandledBy, HandledAt: m.HandledAt.UTC(),
		Feedback: VirtualBabyFeedback{Fit: VirtualBabyFit(f.Fit), Headline: f.Headline, Why: f.Why, Source: sourceOut(f.Source)},
	}
}
