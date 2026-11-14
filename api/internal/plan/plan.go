// Package plan loads a family's data from the store, filtered to what the
// viewing parent may see, and runs the rules engine on it.
package plan

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// ForMember returns the plan for one parent. The clock is passed in so callers
// and tests control it.
func ForMember(ctx context.Context, q *store.Queries, familyID, memberID uuid.UUID, today, now time.Time) ([]rules.Item, error) {
	f, err := LoadFacts(ctx, q, familyID, memberID, today, now)
	if err != nil {
		return nil, err
	}
	return rules.Plan(rules.All(), f), nil
}

func LoadFacts(ctx context.Context, q *store.Queries, familyID, memberID uuid.UUID, today, now time.Time) (rules.Facts, error) {
	fam, err := q.GetFamily(ctx, familyID)
	if err != nil {
		return rules.Facts{}, fmt.Errorf("family: %w", err)
	}
	viewer, err := q.GetMember(ctx, store.GetMemberParams{ID: memberID, FamilyID: familyID})
	if err != nil {
		return rules.Facts{}, fmt.Errorf("member: %w", err)
	}
	members, err := q.ListMembers(ctx, familyID)
	if err != nil {
		return rules.Facts{}, err
	}
	roleOf := map[uuid.UUID]rules.Role{}
	var motherID uuid.UUID
	for _, m := range members {
		roleOf[m.ID] = rules.Role(m.Role)
		if m.Role == string(rules.Mother) {
			motherID = m.ID
		}
	}

	f := rules.Facts{
		Today:         today,
		Viewer:        rules.Role(viewer.Role),
		Stage:         fam.Stage,
		DueDate:       fam.DueDate,
		PregnancyLabs: map[string]time.Time{},
		Immunizations: map[rules.Role]map[string]time.Time{rules.Mother: {}, rules.Partner: {}},
		CareTeam:      map[string]bool{},
	}

	labs, err := q.ListLabResultsVisibleToParent(ctx, store.ListLabResultsVisibleToParentParams{FamilyID: familyID, ViewerID: memberID})
	if err != nil {
		return rules.Facts{}, err
	}
	for _, l := range labs {
		if l.SubjectMemberID.Valid && l.SubjectMemberID.UUID == motherID {
			if prev, ok := f.PregnancyLabs[l.Kind]; !ok || l.TakenOn.After(prev) {
				f.PregnancyLabs[l.Kind] = l.TakenOn
			}
		}
	}

	imms, err := q.ListImmunizations(ctx, familyID)
	if err != nil {
		return rules.Facts{}, err
	}
	for _, im := range imms {
		if !im.SubjectMemberID.Valid {
			continue
		}
		r := roleOf[im.SubjectMemberID.UUID]
		if prev, ok := f.Immunizations[r][im.Vaccine]; !ok || im.GivenOn.After(prev) {
			f.Immunizations[r][im.Vaccine] = im.GivenOn
		}
	}

	team, err := q.ListCareTeam(ctx, familyID)
	if err != nil {
		return rules.Facts{}, err
	}
	for _, c := range team {
		f.CareTeam[c.Role] = true
	}

	// Only the viewer's own check-ins feed their plan.
	moods, err := q.ListMoodCheckinsVisibleToParent(ctx, store.ListMoodCheckinsVisibleToParentParams{
		FamilyID: familyID, ViewerID: memberID, Since: now.Add(-14 * 24 * time.Hour),
	})
	if err != nil {
		return rules.Facts{}, err
	}
	for _, m := range moods {
		if m.OwnerMemberID == memberID {
			f.RecentMoods = append(f.RecentMoods, rules.MoodSample{At: m.RecordedAt, Mood: int(m.Mood)})
		}
	}
	return f, nil
}
