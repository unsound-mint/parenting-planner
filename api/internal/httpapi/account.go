package httpapi

import (
	"context"
	"net/http"

	"github.com/unsound-mint/parenting-planner/api/internal/account"
)

func (s *Server) GetMemberExport(ctx context.Context, req GetMemberExportRequestObject) (GetMemberExportResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetMemberExport401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetMemberExport404JSONResponse(errNoMember), nil
	}
	today := s.today(ctx)
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	e, err := account.ExportFor(ctx, s.pool, familyID, req.MemberId, today)
	if err != nil {
		return nil, err
	}
	out := MemberExport{
		MemberId:             req.MemberId,
		ExportedAt:           s.now(ctx).UTC(),
		Family:               fam,
		Passport:             Passport{MemberId: req.MemberId, People: make([]PassportPerson, 0, len(e.Passport))},
		MoodCheckins:         make([]MoodCheckin, 0, len(e.MoodCheckins)),
		PsychologistBookings: make([]PsychologistBooking, 0, len(e.Bookings)),
		SessionNotes:         make([]SessionNote, 0, len(e.SessionNotes)),
		PlanProgress:         make([]ExportedPlanProgress, 0, len(e.PlanProgress)),
	}
	for _, p := range e.Passport {
		out.Passport.People = append(out.Passport.People, passportPersonOut(p, today))
	}
	for _, c := range e.MoodCheckins {
		out.MoodCheckins = append(out.MoodCheckins, moodCheckinOut(c))
	}
	for _, b := range e.Bookings {
		out.PsychologistBookings = append(out.PsychologistBookings, bookingOut(b))
	}
	for _, n := range e.SessionNotes {
		out.SessionNotes = append(out.SessionNotes, SessionNote{Id: n.ID, BookingId: n.BookingID, WrittenAt: n.WrittenAt.UTC(), Text: n.Text})
	}
	for _, p := range e.PlanProgress {
		out.PlanProgress = append(out.PlanProgress, ExportedPlanProgress{RuleId: p.RuleID, Status: PlanItemProgress(p.Status), UpdatedAt: p.UpdatedAt.UTC()})
	}
	disposition := `attachment; filename="parenting-planner-export-` + today.Format("2006-01-02") + `.json"`
	return GetMemberExport200JSONResponse{Body: out, Headers: GetMemberExport200ResponseHeaders{ContentDisposition: &disposition}}, nil
}

func (s *Server) DeleteFamily(ctx context.Context, _ DeleteFamilyRequestObject) (DeleteFamilyResponseObject, error) {
	familyID, kind := managingFamily(ctx)
	switch kind {
	case errUnauthorized:
		return DeleteFamily401JSONResponse(errNoSession), nil
	case errNotParent:
		return DeleteFamily403JSONResponse(errForbidden), nil
	}
	if err := account.DeleteFamily(ctx, s.pool, familyID); err != nil {
		return nil, err
	}
	cookie := (&http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", HttpOnly: true,
		Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: -1,
	}).String()
	return DeleteFamily204Response{Headers: DeleteFamily204ResponseHeaders{SetCookie: &cookie}}, nil
}
