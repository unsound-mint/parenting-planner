package httpapi

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/shifts"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errNoSchedule   = Error{Code: "forbidden", Message: "you do not have access to schedules"}
	errShiftOverlap = Error{Code: "shift_overlap", Message: "this shift overlaps one of your own shifts"}
	errShiftTimes   = Error{Code: "bad_times", Message: "a shift cannot start and end at the same time"}
)

// canSchedule: parents always, a caregiver with the schedule permission.
func canSchedule(m store.Member) bool {
	return isParentRole(m.Role) || slices.Contains(m.Permissions, "schedule")
}

func shiftOut(s store.Shift) Shift {
	days := make([]Weekday, 0, len(s.Days))
	for _, d := range s.Days {
		days = append(days, Weekday(d))
	}
	out := Shift{
		Id: s.ID, MemberId: s.MemberID, Title: s.Title, Days: days, StartTime: s.StartTime, EndTime: s.EndTime,
		Status: ShiftStatus(s.Status), CreatedAt: s.CreatedAt,
	}
	if s.StartsOn != nil {
		out.StartsOn = &openapi_types.Date{Time: *s.StartsOn}
	}
	if s.RoundID.Valid {
		id := s.RoundID.UUID
		out.RoundId = &id
	}
	return out
}

func (s *Server) CreateShift(ctx context.Context, req CreateShiftRequestObject) (CreateShiftResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateShift401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateShift404JSONResponse(errNoMember), nil
	case !canSchedule(m):
		return CreateShift403JSONResponse(errNoSchedule), nil
	}
	b := req.Body
	days := make([]string, 0, len(b.Days))
	for _, d := range b.Days {
		days = append(days, string(d))
	}
	var round *uuid.UUID
	if b.RoundId != nil {
		round = b.RoundId
	}
	sh, err := shifts.Create(ctx, s.pool, familyID, m.ID, shifts.New{Title: b.Title, Days: days, Start: b.StartTime, End: b.EndTime, RoundID: round}, s.today(ctx))
	switch {
	case errors.Is(err, shifts.ErrOverlap):
		return CreateShift409JSONResponse(errShiftOverlap), nil
	case errors.Is(err, shifts.ErrSameTime):
		return CreateShift400JSONResponse(errShiftTimes), nil
	case err != nil:
		return nil, err
	}
	return CreateShift201JSONResponse(shiftOut(sh)), nil
}

func (s *Server) ListShifts(ctx context.Context, req ListShiftsRequestObject) (ListShiftsResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListShifts401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListShifts404JSONResponse(errNoMember), nil
	case !canSchedule(m):
		return ListShifts403JSONResponse(errNoSchedule), nil
	}
	var only *uuid.UUID
	if !isParentRole(m.Role) {
		only = &m.ID
	}
	rows, err := shifts.List(ctx, s.pool, familyID, only)
	if err != nil {
		return nil, err
	}
	items := make([]Shift, 0, len(rows))
	for _, r := range rows {
		items = append(items, shiftOut(r))
	}
	return ListShifts200JSONResponse{Items: items}, nil
}
