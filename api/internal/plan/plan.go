// Package plan loads a family's data from the store, filtered to what the
// viewing parent may see, and runs the rules engine on it.
package plan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// ForMember returns the plan for one parent, with the progress that parent
// recorded on each item. The clock is passed in so callers and tests control it.
func ForMember(ctx context.Context, q *store.Queries, familyID, memberID uuid.UUID, today, now time.Time) ([]rules.Item, error) {
	f, err := LoadFacts(ctx, q, familyID, memberID, today, now)
	if err != nil {
		return nil, err
	}
	items := rules.Plan(rules.All(), f)
	// Only this parent's own progress; a booked or done item stays on the
	// plan with its status unchanged, so nothing disappears unseen.
	progress, err := q.ListPlanItemProgress(ctx, store.ListPlanItemProgressParams{FamilyID: familyID, MemberID: memberID})
	if err != nil {
		return nil, err
	}
	byRule := make(map[string]string, len(progress))
	for _, p := range progress {
		byRule[p.RuleID] = p.Status
	}
	for i := range items {
		items[i].Progress = byRule[items[i].RuleID]
	}
	return items, nil
}

const entityPlanItemProgress = "plan_item_progress"

// ErrNotOnPlan means the rule id is not on this parent's plan right now.
var ErrNotOnPlan = errors.New("plan: item is not on this parent's plan")

// SetProgress records the acting parent's progress on one item of their own
// plan and returns the item with it. Only items currently on that parent's
// plan can be marked; anything else is ErrNotOnPlan.
func SetProgress(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, ruleID, status string, today, now time.Time) (rules.Item, error) {
	var out rules.Item
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		items, err := ForMember(ctx, q, familyID, actor, today, now)
		if err != nil {
			return err
		}
		idx := slices.IndexFunc(items, func(it rules.Item) bool { return it.RuleID == ruleID })
		if idx < 0 {
			return ErrNotOnPlan
		}
		p, err := q.UpsertPlanItemProgress(ctx, store.UpsertPlanItemProgressParams{
			FamilyID: familyID, MemberID: actor, RuleID: ruleID, Status: status, UpdatedAt: now,
		})
		if err != nil {
			return err
		}
		out = items[idx]
		out.Progress = p.Status
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityPlanItemProgress, p.ID.String())
	})
	return out, err
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
		PregnancyLoss: fam.PregnancyLossRecordedAt.Valid,
		PregnancyLabs: map[string]time.Time{},
		Immunizations: map[rules.Role]map[string]time.Time{rules.Mother: {}, rules.Partner: {}},
		CareTeam:      map[string]bool{},
	}

	labs, err := q.ListLabResultsVisibleToParent(ctx, store.ListLabResultsVisibleToParentParams{FamilyID: familyID, ViewerID: memberID})
	if err != nil {
		return rules.Facts{}, err
	}
	children, err := q.ListChildren(ctx, familyID)
	if err != nil {
		return rules.Facts{}, err
	}
	childIdx := map[uuid.UUID]int{}
	for i, c := range children {
		childIdx[c.ID] = i
		f.Children = append(f.Children, rules.ChildFacts{Name: c.Name, BirthDate: c.BirthDate, Doses: map[string]int{}, Labs: map[string]time.Time{}})
	}

	// Labs come newest first, so the first rubella result seen is the latest.
	for _, l := range labs {
		if l.SubjectMemberID.Valid && l.SubjectMemberID.UUID == motherID {
			if prev, ok := f.PregnancyLabs[l.Kind]; !ok || l.TakenOn.After(prev) {
				f.PregnancyLabs[l.Kind] = l.TakenOn
			}
			var res struct {
				Rubella string `json:"rubella"`
			}
			if f.MotherRubella == "" && json.Unmarshal(l.Result, &res) == nil {
				f.MotherRubella = res.Rubella
			}
		}
		if i, ok := childIdx[l.SubjectChildID.UUID]; ok && l.SubjectChildID.Valid {
			if prev, ok := f.Children[i].Labs[l.Kind]; !ok || l.TakenOn.After(prev) {
				f.Children[i].Labs[l.Kind] = l.TakenOn
			}
		}
	}

	imms, err := q.ListImmunizations(ctx, familyID)
	if err != nil {
		return rules.Facts{}, err
	}
	for _, im := range imms {
		if i, ok := childIdx[im.SubjectChildID.UUID]; ok && im.SubjectChildID.Valid {
			f.Children[i].Doses[im.Vaccine]++
			continue
		}
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

	// Only the viewer's own questionnaires feed their plan.
	screens, err := q.ListMoodScreeningsVisibleToParent(ctx, store.ListMoodScreeningsVisibleToParentParams{
		FamilyID: familyID, ViewerID: memberID, Since: now.AddDate(-1, 0, 0),
	})
	if err != nil {
		return rules.Facts{}, err
	}
	for _, s := range screens {
		if s.OwnerMemberID == memberID {
			f.MoodScreenings = append(f.MoodScreenings, rules.ScreeningSample{
				At: s.TakenAt, Instrument: s.Instrument, Score: int(s.Score), Band: rules.Band(s.Band), Urgent: s.Urgent,
			})
		}
	}

	// Only the viewer's own session notes and bookings; the plan sees when a
	// note was written, never its text.
	notes, err := q.ListSessionNotesVisibleToParent(ctx, store.ListSessionNotesVisibleToParentParams{
		FamilyID: familyID, ViewerID: memberID, Since: now.Add(-14 * 24 * time.Hour),
	})
	if err != nil {
		return rules.Facts{}, err
	}
	for _, n := range notes {
		if n.OwnerMemberID == memberID {
			at := n.WrittenAt
			f.LastSessionNoteAt = &at
			break
		}
	}
	bookings, err := q.ListPsychologistBookingsVisibleToParent(ctx, store.ListPsychologistBookingsVisibleToParentParams{
		FamilyID: familyID, ViewerID: memberID,
	})
	if err != nil {
		return rules.Facts{}, err
	}
	for _, b := range bookings {
		if b.OwnerMemberID == memberID && b.StartsAt.After(now) {
			f.NextSessionBooked = true
		}
	}

	// The childcare tracker is family-wide: both parents see every option.
	options, err := q.ListChildcareOptions(ctx, familyID)
	if err != nil {
		return rules.Facts{}, err
	}
	for _, o := range options {
		f.ChildcareOptions = append(f.ChildcareOptions, rules.ChildcareOptionFacts{Name: o.Name, Status: o.Status, DecideBy: o.DecideBy})
	}
	return f, nil
}
