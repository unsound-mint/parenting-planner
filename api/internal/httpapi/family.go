package httpapi

import (
	"context"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/billing"
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
	children, err := s.q.ListChildren(ctx, id)
	if err != nil {
		return Family{}, err
	}
	today := s.today()
	out := Family{
		Id: fam.ID, Template: DemoTemplate(fam.Template), Stage: Stage(fam.Stage),
		Parents: make([]Parent, 0, len(members)), Caregivers: []Caregiver{}, Children: make([]Child, 0, len(children)),
	}
	if fam.DueDate != nil {
		out.DueDate = &openapi_types.Date{Time: *fam.DueDate}
		f := rules.Facts{Today: today, Stage: fam.Stage, DueDate: fam.DueDate}
		if w, ok := f.GestationalWeek(); ok {
			out.GestationalWeek = &w
		}
	}
	// Caregivers are not stored yet: the seed and a table come with the backend half of #1.

	// One subscription covers the family, so both parents get its tier.
	sub, hasSub, err := billing.Current(ctx, s.q, id)
	if err != nil {
		return Family{}, err
	}
	tier := Tier(billing.Tier(sub, hasSub))
	out.Tier = &tier
	if hasSub {
		out.Subscription = &Subscription{Tier: PaidTier(sub.Tier), Status: SubscriptionStatus(sub.Status), StartedAt: sub.StartedAt.UTC()}
		if sub.CurrentPeriodEnd.Valid {
			end := sub.CurrentPeriodEnd.Time.UTC()
			out.Subscription.CurrentPeriodEnd = &end
		}
	}
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
