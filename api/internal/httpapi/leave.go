package httpapi

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/leave"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func leaveSource(s leave.Source) Source {
	return Source{Title: s.Title, Url: s.URL, CheckedAt: openapi_types.Date{Time: s.CheckedAt}}
}

// leaveFor computes one parent's programs, timeline and deadlines from their saved answers.
// A parent without answers has no input and empty lists.
func (s *Server) leaveFor(m store.Member, plan *store.LeavePlan, anchor *time.Time) ParentLeave {
	out := ParentLeave{MemberId: m.ID, Role: ParentRole(m.Role), Programs: []LeaveProgram{}, Segments: []LeaveSegment{}, Deadlines: []LeaveDeadline{}}
	if plan == nil {
		return out
	}
	in := LeavePlanInput{
		State: plan.State, EmployerEmployees: int(plan.EmployerEmployees), MonthsEmployed: int(plan.MonthsEmployed),
		HoursLast12Months: int(plan.HoursLast12Months),
	}
	a := leave.Answers{
		State: plan.State, EmployerEmployees: int(plan.EmployerEmployees), MonthsEmployed: int(plan.MonthsEmployed),
		HoursLast12Months: int(plan.HoursLast12Months), StartsOn: plan.StartsOn,
	}
	if plan.StartsOn != nil {
		in.StartsOn = &openapi_types.Date{Time: *plan.StartsOn}
	}
	weeks := leave.DefaultWeeks
	if plan.WeeksWanted.Valid {
		w := int(plan.WeeksWanted.Int32)
		in.WeeksWanted, weeks = &w, w
	}
	out.Input = &in

	programs := leave.Programs(a)
	for _, p := range programs {
		lp := LeaveProgram{
			Id: p.ID, Name: p.Name, Kind: LeaveProgramKind(p.Kind), Eligibility: LeaveEligibility(p.Eligibility),
			Weeks: p.Weeks, Reason: p.Reason, Source: leaveSource(p.Source),
		}
		if p.Pay != "" {
			pay := p.Pay
			lp.Pay = &pay
		}
		out.Programs = append(out.Programs, lp)
	}
	start := anchor
	if plan.StartsOn != nil {
		start = plan.StartsOn
	}
	if start == nil {
		return out
	}
	for _, sg := range leave.Timeline(programs, *start, weeks) {
		out.Segments = append(out.Segments, LeaveSegment{
			StartsOn: openapi_types.Date{Time: sg.StartsOn}, EndsOn: openapi_types.Date{Time: sg.EndsOn},
			ProgramIds: sg.ProgramIDs, Paid: sg.Paid, JobProtected: sg.JobProtected,
		})
	}
	for _, d := range leave.Deadlines(programs, *start) {
		ld := LeaveDeadline{Title: d.Title, DueOn: openapi_types.Date{Time: d.DueOn}, Source: leaveSource(d.Source)}
		if d.ProgramID != "" {
			id := d.ProgramID
			ld.ProgramId = &id
		}
		out.Deadlines = append(out.Deadlines, ld)
	}
	return out
}

// leavePlan builds the whole family's plan: the acting parent first, then the other.
func (s *Server) leavePlan(ctx context.Context, familyID uuid.UUID, actor uuid.UUID) (LeavePlan, error) {
	members, err := s.q.ListMembers(ctx, familyID)
	if err != nil {
		return LeavePlan{}, err
	}
	rows, err := s.q.ListLeavePlans(ctx, familyID)
	if err != nil {
		return LeavePlan{}, err
	}
	plans := map[uuid.UUID]*store.LeavePlan{}
	for i := range rows {
		plans[rows[i].MemberID] = &rows[i]
	}
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return LeavePlan{}, err
	}
	kids, err := s.q.ListChildren(ctx, familyID)
	if err != nil {
		return LeavePlan{}, err
	}
	anchor := fam.DueDate // after "Baby is home" the birth date
	if len(kids) > 0 {
		anchor = &kids[0].BirthDate
	}
	out := LeavePlan{Parents: make([]ParentLeave, 0, len(members))}
	for _, first := range []bool{true, false} {
		for _, m := range members {
			if (m.ID == actor) == first {
				out.Parents = append(out.Parents, s.leaveFor(m, plans[m.ID], anchor))
			}
		}
	}
	return out, nil
}

func (s *Server) GetLeavePlan(ctx context.Context, req GetLeavePlanRequestObject) (GetLeavePlanResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetLeavePlan401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetLeavePlan404JSONResponse(errNoMember), nil
	}
	plan, err := s.leavePlan(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	return GetLeavePlan200JSONResponse(plan), nil
}

func (s *Server) UpdateLeavePlan(ctx context.Context, req UpdateLeavePlanRequestObject) (UpdateLeavePlanResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateLeavePlan401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateLeavePlan404JSONResponse(errNoMember), nil
	}
	b := req.Body
	p := store.UpsertLeavePlanParams{
		FamilyID: familyID, MemberID: req.MemberId, State: b.State, EmployerEmployees: int32(b.EmployerEmployees),
		MonthsEmployed: int32(b.MonthsEmployed), HoursLast12Months: int32(b.HoursLast12Months),
	}
	if b.StartsOn != nil {
		p.StartsOn = &b.StartsOn.Time
	}
	if b.WeeksWanted != nil {
		p.WeeksWanted = pgtype.Int4{Int32: int32(*b.WeeksWanted), Valid: true}
	}
	if _, err := s.q.UpsertLeavePlan(ctx, p); err != nil {
		return nil, err
	}
	plan, err := s.leavePlan(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	return UpdateLeavePlan200JSONResponse(plan), nil
}
