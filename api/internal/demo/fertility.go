package demo

import (
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// SealKey seals the free-text notes of the seeded fertility journal. The API sets it to
// the same key it uses for the diary, so the demo family can read what was seeded.
var SealKey crypt.Key

// seedFertility gives the planning family a journal worth looking at: five cycles of
// Maya's (the fourth month of trying), a positive ovulation test last cycle, a
// temperature curve, two notes, a half-done readiness checklist for both of them and
// a preconception visit next week with questions. Maya's period and temperature
// entries are private; a few are shared with Daniel so the sharing is visible.
func (s *seeder) fertility(maya, daniel uuid.UUID) {
	if s.err != nil {
		return
	}
	day := func(offset int) time.Time { return s.today.AddDate(0, 0, offset) }
	add := func(owner uuid.UUID, vis, kind string, offset int, code *string, temp *float64, note string) {
		if s.err != nil {
			return
		}
		var sealed []byte
		if note != "" {
			sealed, s.err = SealKey.Seal(note)
			if s.err != nil {
				return
			}
		}
		_, s.err = s.q.CreateFertilityEntry(s.ctx, store.CreateFertilityEntryParams{
			FamilyID: s.fam, OwnerMemberID: owner, Visibility: vis, Kind: kind, EntryDate: day(offset), Code: code, TempC: temp, NoteSealed: sealed,
		})
	}

	// Cycle starts, newest first: the current cycle is on day 10 today.
	lengths := []int{28, 29, 30, 28}
	starts := []int{-9}
	for _, l := range lengths {
		starts = append(starts, starts[len(starts)-1]-l)
	}
	flows := []string{"medium", "heavy", "medium", "light", "light"}
	for i, st := range starts {
		for d, f := range flows {
			vis := "private"
			if i == 0 {
				vis = "partner" // this cycle is shared with Daniel
			}
			add(maya, vis, "period", st+d, ptr(f), nil, "")
		}
	}
	add(maya, "private", "symptom", starts[0], ptr("cramps"), nil, "")
	add(maya, "private", "symptom", starts[1], ptr("cramps"), nil, "")
	add(maya, "private", "symptom", starts[1]+1, ptr("low_energy"), nil, "")
	add(maya, "private", "symptom", starts[1]+12, ptr("fertile_mucus"), nil, "")
	add(maya, "private", "symptom", starts[1]+13, ptr("fertile_mucus"), nil, "")
	add(maya, "private", "symptom", starts[1]+22, ptr("breast_tenderness"), nil, "")

	// Last cycle: ovulation tests from day 10, positive on day 14, and a temperature
	// curve that rises about 0.3 C after ovulation.
	for d, r := range []string{"negative", "negative", "negative", "faint", "positive", "negative"} {
		add(maya, "private", "ovulation_test", starts[1]+9+d, ptr(r), nil, "")
	}
	for d := 0; d < 28; d++ {
		t := 36.35 + float64((d*7)%5)*0.03
		if d > 14 {
			t += 0.32
		}
		add(maya, "private", "bbt", starts[1]+d, nil, ptr(t), "")
	}
	for d := 0; d < 10; d++ {
		add(maya, "private", "bbt", starts[0]+d, nil, ptr(36.34+float64((d*7)%5)*0.03), "")
	}
	add(maya, "private", "ovulation_test", -1, ptr("negative"), nil, "")

	// Tests and a note from the clinic.
	add(maya, "partner", "treatment_note", -20, nil, nil,
		"Dr. Okafor: keep tracking for three cycles before more tests, start folic acid, bring the cycle chart to the next visit.")
	add(maya, "private", "test", 8, nil, nil, "Day 3 hormone blood test (booked). Ask whether to do it this cycle or next.")
	add(daniel, "partner", "test", 12, nil, nil, "Semen analysis at the Cedar Park lab, booked for Saturday morning.")

	// Journey preferences: Maya has been trying for five months.
	if s.err == nil {
		since := day(0).AddDate(0, -5, 0)
		_, s.err = s.q.UpsertJourneySettings(s.ctx, store.UpsertJourneySettingsParams{
			FamilyID: s.fam, OwnerMemberID: maya, TryingSince: &since, UpdatedAt: s.today.Add(9 * time.Hour),
		})
	}

	// Readiness: Maya has done 4 of 8, Daniel 3 of 7. Some ticks are shared.
	tick := func(owner uuid.UUID, key, vis string, daysAgo int) {
		if s.err != nil {
			return
		}
		_, s.err = s.q.UpsertPreconceptionTick(s.ctx, store.UpsertPreconceptionTickParams{
			FamilyID: s.fam, OwnerMemberID: owner, Visibility: vis, ItemKey: key, DoneAt: day(-daysAgo).Add(18 * time.Hour),
		})
	}
	tick(maya, "folic_acid", "partner", 40)
	tick(maya, "planning_visit", "partner", 35)
	tick(maya, "smoking", "private", 60)
	tick(maya, "alcohol", "private", 60)
	tick(daniel, "smoking", "partner", 30)
	tick(daniel, "alcohol", "partner", 30)
	tick(daniel, "question_list", "private", 3)

	// The preconception visit next week, with questions from both.
	if s.err != nil {
		return
	}
	visit, err := s.q.CreateCalendarEvent(s.ctx, store.CreateCalendarEventParams{
		FamilyID: s.fam, OwnerMemberID: maya, Visibility: "family", Kind: "appointment",
		Title: "Preconception visit with Dr. Okafor", StartsAt: day(6).Add(10 * time.Hour),
	})
	if err != nil {
		s.err = err
		return
	}
	if s.err = s.q.AddCalendarEventAttendee(s.ctx, store.AddCalendarEventAttendeeParams{EventID: visit.ID, MemberID: daniel}); s.err != nil {
		return
	}
	for _, q := range []struct {
		owner uuid.UUID
		vis   string
		text  string
	}{
		{maya, "partner", "How long should we keep trying before we ask for tests?"},
		{maya, "private", "Should my thyroid be checked again before we try?"},
		{daniel, "partner", "Is a semen analysis a good first step for me?"},
	} {
		if _, s.err = s.q.CreateAppointmentQuestion(s.ctx, store.CreateAppointmentQuestionParams{
			FamilyID: s.fam, OwnerMemberID: q.owner, Visibility: q.vis, AskedForEventID: visit.ID, Body: q.text,
		}); s.err != nil {
			return
		}
	}
}
