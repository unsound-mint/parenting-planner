package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/recovery"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errRecoveryMotherOnly = Error{Code: "forbidden", Message: "the recovery tracker is the birth parent's own"}
	errRecoveryNoBaby     = Error{Code: "no_child", Message: "no baby is on record yet"}
	errNoRecoveryCheckin  = Error{Code: "not_found", Message: "no such recovery check-in"}
)

func recoveryOut(c store.RecoveryCheckin) RecoveryCheckin {
	signs := make([]RecoveryWarningSign, 0, len(c.WarningSigns))
	for _, s := range c.WarningSigns {
		signs = append(signs, RecoveryWarningSign(s))
	}
	out := RecoveryCheckin{
		Id: c.ID, AuthorId: c.OwnerMemberID, RecordedAt: c.RecordedAt.UTC(), Visibility: Visibility(c.Visibility),
		Bleeding: RecoveryBleeding(c.Bleeding), Pain: int(c.Pain), Wound: RecoveryWound(c.Wound), Breasts: RecoveryBreasts(c.Breasts),
		PelvicFloor: RecoveryPelvicFloor(c.PelvicFloor), SleepHours: c.SleepHours, WarningSigns: signs, Note: c.Note,
		Urgent: rules.RecoveryUrgent(c.Bleeding, c.WarningSigns),
	}
	if c.Mood.Valid {
		m := int(c.Mood.Int16)
		out.Mood = &m
	}
	return out
}

func (s *Server) CreateRecoveryCheckin(ctx context.Context, req CreateRecoveryCheckinRequestObject) (CreateRecoveryCheckinResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateRecoveryCheckin401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateRecoveryCheckin404JSONResponse(errNoMember), nil
	case m.Role != "mother":
		return CreateRecoveryCheckin403JSONResponse(errRecoveryMotherOnly), nil
	}
	b := req.Body
	in := recovery.New{
		Visibility: access.Visibility(b.Visibility), RecordedAt: s.now(ctx), Bleeding: string(b.Bleeding), Wound: string(b.Wound),
		Breasts: string(b.Breasts), PelvicFloor: string(b.PelvicFloor), Pain: int16(b.Pain), SleepHours: b.SleepHours, Note: b.Note,
	}
	if b.Mood != nil {
		v := int16(*b.Mood)
		in.Mood = &v
	}
	if b.WarningSigns != nil {
		for _, w := range *b.WarningSigns {
			in.WarningSigns = append(in.WarningSigns, string(w))
		}
	}
	c, err := recovery.Create(ctx, s.pool, familyID, req.MemberId, in)
	if errors.Is(err, recovery.ErrNoChild) {
		return CreateRecoveryCheckin409JSONResponse(errRecoveryNoBaby), nil
	}
	if err != nil {
		return nil, err
	}
	return CreateRecoveryCheckin201JSONResponse(recoveryOut(c)), nil
}

func (s *Server) ListRecoveryCheckins(ctx context.Context, req ListRecoveryCheckinsRequestObject) (ListRecoveryCheckinsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListRecoveryCheckins401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListRecoveryCheckins404JSONResponse(errNoMember), nil
	}
	rows, err := recovery.List(ctx, s.pool, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := RecoveryCheckinList{Items: make([]RecoveryCheckin, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, recoveryOut(r))
	}
	return ListRecoveryCheckins200JSONResponse(out), nil
}

func (s *Server) UpdateRecoveryCheckin(ctx context.Context, req UpdateRecoveryCheckinRequestObject) (UpdateRecoveryCheckinResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateRecoveryCheckin401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateRecoveryCheckin404JSONResponse(errNoMember), nil
	}
	c, err := recovery.SetVisibility(ctx, s.pool, familyID, req.MemberId, openapi_types.UUID(req.CheckinId), access.Visibility(req.Body.Visibility))
	if errors.Is(err, recovery.ErrNoCheckin) {
		return UpdateRecoveryCheckin404JSONResponse(errNoRecoveryCheckin), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateRecoveryCheckin200JSONResponse(recoveryOut(c)), nil
}

func (s *Server) GetRecoveryGuidance(ctx context.Context, req GetRecoveryGuidanceRequestObject) (GetRecoveryGuidanceResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetRecoveryGuidance401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetRecoveryGuidance404JSONResponse(errNoMember), nil
	}
	g, err := recovery.GuidanceFor(ctx, s.q, familyID, s.today(ctx))
	if errors.Is(err, recovery.ErrNoChild) {
		return GetRecoveryGuidance409JSONResponse(errRecoveryNoBaby), nil
	}
	if err != nil {
		return nil, err
	}
	out := RecoveryGuidance{
		Phase: RecoveryGuidancePhase(g.Phase), Headline: g.Headline, Points: g.Points, DaysSinceBirth: g.DaysSinceBirth,
		Sources: make([]Source, 0, len(g.Sources)),
	}
	out.PostnatalCheck.OpensOn = openapi_types.Date{Time: g.Check.Opens}
	out.PostnatalCheck.ClosesOn = openapi_types.Date{Time: g.Check.Closes}
	out.PostnatalCheck.LatestOn = openapi_types.Date{Time: g.Check.Latest}
	out.PostnatalCheck.Status = RecoveryGuidancePostnatalCheckStatus(g.Check.Status)
	for _, src := range g.Sources {
		out.Sources = append(out.Sources, Source{Title: src.Title, Url: src.URL, CheckedAt: openapi_types.Date{Time: src.CheckedAt}})
	}
	return GetRecoveryGuidance200JSONResponse(out), nil
}
