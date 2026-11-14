package httpapi

import (
	"context"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/upgrade"
)

func (s *Server) GetFamily(ctx context.Context, _ GetFamilyRequestObject) (GetFamilyResponseObject, error) {
	familyID, ok := familyFrom(ctx)
	if !ok {
		return GetFamily401JSONResponse(errNoSession), nil
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	// Set here, not in loadFamily: loadFamily also builds the family for a new
	// session while the request still carries the old one.
	if bound, _ := ctx.Value(sessionMemberKey{}).(uuid.NullUUID); bound.Valid {
		fam.SessionMemberId = &bound.UUID
	}
	// A grandparent or nanny must not learn why pregnancy updates stopped. A demo
	// session has no role and is a parent's view.
	if role, _ := ctx.Value(sessionRoleKey{}).(string); role != "" && !isParentRole(role) {
		fam.PregnancyLoss = nil
	}
	return GetFamily200JSONResponse(fam), nil
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
	caregivers, err := s.q.ListCaregivers(ctx, id)
	if err != nil {
		return Family{}, err
	}
	children, err := s.q.ListChildren(ctx, id)
	if err != nil {
		return Family{}, err
	}
	// The family row's offset, not the session's: right after a skip or a new
	// demo, the request context still holds the old value.
	today := s.realToday().AddDate(0, 0, int(fam.DemoOffsetDays))
	daysAhead := int(fam.DemoOffsetDays)
	out := Family{
		Id: fam.ID, Template: DemoTemplate(fam.Template), Stage: Stage(fam.Stage), DemoDaysAhead: &daysAhead,
		Parents: make([]Parent, 0, len(members)), Caregivers: []Caregiver{}, Children: make([]Child, 0, len(children)),
	}
	if fam.DueDate != nil {
		out.DueDate = &openapi_types.Date{Time: *fam.DueDate}
		f := rules.Facts{Today: today, Stage: fam.Stage, DueDate: fam.DueDate}
		if w, ok := f.GestationalWeek(); ok {
			out.GestationalWeek = &w
		}
	}
	if fam.PregnancyLossRecordedAt.Valid {
		loss := PregnancyLoss{RecordedAt: fam.PregnancyLossRecordedAt.Time}
		if fam.PregnancyLossOccurredOn != nil {
			loss.OccurredOn = &openapi_types.Date{Time: *fam.PregnancyLossOccurredOn}
		}
		out.PregnancyLoss = &loss
	}

	// There is no billing, so every family stays on free; an upgrade intent
	// only shows as "upgrade requested".
	tier := TierFree
	out.Tier = &tier
	intent, ok, err := upgrade.Current(ctx, s.q, id)
	if err != nil {
		return Family{}, err
	}
	if ok {
		req := upgradeIntentOut(intent)
		out.UpgradeRequest = &req
	}
	for _, m := range members {
		out.Parents = append(out.Parents, Parent{Id: m.ID, Role: ParentRole(m.Role), DisplayName: m.DisplayName})
	}
	for _, c := range caregivers {
		out.Caregivers = append(out.Caregivers, Caregiver{Id: c.ID, Role: CaregiverRole(c.Role), DisplayName: c.DisplayName, Permissions: permissionsOut(c.Permissions)})
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

func permissionsOut(in []string) []CaregiverPermission {
	out := make([]CaregiverPermission, 0, len(in))
	for _, p := range in {
		out = append(out, CaregiverPermission(p))
	}
	return out
}
