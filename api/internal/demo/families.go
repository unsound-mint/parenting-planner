package demo

// The planning, newborn and preschool families. Each one differs from the
// others in stage, children, labs, vaccines, care team and mood history, so
// the same rules produce a different plan, timeline and passport for each.
// All names, clinics and doctors are invented.

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

const (
	Planning  Template = "planning"
	Newborn   Template = "newborn"
	Preschool Template = "preschool"
)

// seeder keeps the per-family seed functions short: it remembers the family
// and the first error, so a seed reads as a list of rows.
type seeder struct {
	ctx   context.Context
	q     *store.Queries
	today time.Time
	fam   uuid.UUID
	err   error
	// paperwork, when set, seeds the paperwork checklist for these parents at the end.
	paperwork *struct{ mother, partner uuid.UUID }
}

func newSeeder(ctx context.Context, q *store.Queries, today time.Time, t Template, stage string, due *time.Time) *seeder {
	s := &seeder{ctx: ctx, q: q, today: today}
	fam, err := q.CreateFamily(ctx, store.CreateFamilyParams{Template: string(t), Stage: stage, DueDate: due})
	s.fam, s.err = fam.ID, err
	return s
}

func (s *seeder) member(role, name string, born time.Time) uuid.UUID {
	if s.err != nil {
		return uuid.Nil
	}
	m, err := s.q.CreateMember(s.ctx, store.CreateMemberParams{FamilyID: s.fam, Role: role, DisplayName: name, BirthDate: &born})
	s.err = err
	return m.ID
}

func (s *seeder) child(name string, born time.Time) uuid.UUID {
	if s.err != nil {
		return uuid.Nil
	}
	c, err := s.q.CreateChild(s.ctx, store.CreateChildParams{FamilyID: s.fam, Name: name, BirthDate: born})
	s.err = err
	return c.ID
}

func (s *seeder) careTeam(role, name string, phone, address *string) {
	if s.err != nil {
		return
	}
	_, s.err = s.q.CreateCareTeamMember(s.ctx, store.CreateCareTeamMemberParams{FamilyID: s.fam, Role: role, Name: name, Phone: phone, Address: address})
}

// subject is who a lab or vaccine is about: a parent or a child.
type subject struct{ member, child uuid.UUID }

func parent(id uuid.UUID) subject  { return subject{member: id} }
func childOf(id uuid.UUID) subject { return subject{child: id} }

func (sub subject) ids() (uuid.NullUUID, uuid.NullUUID) {
	return uuid.NullUUID{UUID: sub.member, Valid: sub.member != uuid.Nil}, uuid.NullUUID{UUID: sub.child, Valid: sub.child != uuid.Nil}
}

func (s *seeder) lab(sub subject, owner uuid.UUID, visibility, kind string, takenOn time.Time, result string) {
	if s.err != nil {
		return
	}
	m, c := sub.ids()
	_, s.err = s.q.CreateLabResult(s.ctx, store.CreateLabResultParams{
		FamilyID: s.fam, SubjectMemberID: m, SubjectChildID: c, OwnerMemberID: owner,
		Visibility: visibility, Kind: kind, TakenOn: takenOn, Result: []byte(result),
	})
}

func (s *seeder) vaccine(sub subject, vaccine string, givenOn time.Time) {
	if s.err != nil {
		return
	}
	m, c := sub.ids()
	_, s.err = s.q.CreateImmunization(s.ctx, store.CreateImmunizationParams{FamilyID: s.fam, SubjectMemberID: m, SubjectChildID: c, Vaccine: vaccine, GivenOn: givenOn})
}

// childAllergy records an allergy of the child, owned by a parent.
func (s *seeder) childAllergy(child uuid.UUID, owner uuid.UUID, visibility, substance, certainty, reaction string, notedOn time.Time) {
	if s.err != nil {
		return
	}
	_, s.err = s.q.CreateAllergy(s.ctx, store.CreateAllergyParams{
		FamilyID: s.fam, SubjectChildID: uuid.NullUUID{UUID: child, Valid: true}, OwnerMemberID: owner,
		Visibility: visibility, Substance: substance, Certainty: certainty, Reaction: &reaction, NotedOn: &notedOn,
	})
}

// mood records a check-in daysAgo days before today, in the evening. daysAgo
// is at least 1 so a morning visitor never sees a check-in from the future.
func (s *seeder) mood(owner uuid.UUID, visibility string, daysAgo, mood, energy int, sleep float64, note string) {
	if s.err != nil {
		return
	}
	var n *string
	if note != "" {
		n = &note
	}
	_, s.err = s.q.CreateMoodCheckin(s.ctx, store.CreateMoodCheckinParams{
		FamilyID: s.fam, OwnerMemberID: owner, Visibility: visibility,
		RecordedAt: s.today.AddDate(0, 0, -daysAgo).Add(20 * time.Hour),
		Mood:       int16(mood), Energy: int16(energy), SleepHours: sleep, Note: n,
	})
}

func (s *seeder) done() (uuid.UUID, error) {
	if s.err == nil {
		s.err = seedCaregivers(s.ctx, s.q, s.fam)
	}
	if s.err == nil && s.paperwork != nil {
		s.err = tasks.SeedPaperwork(s.ctx, s.q, s.fam, s.paperwork.mother, s.paperwork.partner, map[int]bool{0: true}, s.today)
	}
	if s.err != nil {
		return uuid.Nil, s.err
	}
	return s.fam, nil
}

func date(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

// Maya (mother) and Daniel (partner) plan their first baby in the coming
// months. Maya's preconception labs show she is not immune to rubella and
// she has no MMR on record; Daniel has not had Tdap in over ten years.
// No children, no due date.
func seedPlanning(ctx context.Context, q *store.Queries, today time.Time) (uuid.UUID, error) {
	s := newSeeder(ctx, q, today, Planning, "planning", nil)
	maya := s.member("mother", "Maya", date(1995, 2, 18))
	daniel := s.member("partner", "Daniel", date(1992, 7, 30))
	s.careTeam("primary_care", "Dr. Helen Brooks", ptr("(503) 555-0178"), ptr("Cedar Park Family Medicine, Portland, OR"))
	s.careTeam("obgyn", "Dr. Amara Okafor", ptr("(503) 555-0119"), nil)
	s.lab(parent(maya), maya, "family", "preconception_panel", today.AddDate(0, 0, -21),
		`{"hemoglobin_g_dl": 13.1, "blood_type": "A+", "rubella": "not immune", "varicella": "immune", "tsh_miu_l": 1.8}`)
	s.vaccine(parent(maya), "flu", today.AddDate(0, 0, -30))
	s.vaccine(parent(daniel), "tdap", today.AddDate(-11, 0, 0))
	s.vaccine(parent(daniel), "flu", today.AddDate(0, 0, -30))
	for i, m := range []struct{ mood, energy int }{{4, 4}, {4, 3}, {3, 3}, {4, 4}} {
		s.mood(maya, "partner", 1+2*i, m.mood, m.energy, 7.5, "")
	}
	s.mood(daniel, "partner", 2, 4, 4, 7, "")
	return s.done()
}

// Aisha (mother) and Marcus (partner) are home with Leo, born 7 weeks ago.
// Leo had his birth hepatitis B dose but not the 2-month vaccines; Aisha has
// not had her full postpartum visit; Marcus is sleeping little and logged
// three low days this week (kept private, so only his own plan sees them).
func seedNewborn(ctx context.Context, q *store.Queries, today time.Time) (uuid.UUID, error) {
	born := today.AddDate(0, 0, -49)
	s := newSeeder(ctx, q, today, Newborn, "postpartum", nil)
	aisha := s.member("mother", "Aisha", date(1997, 11, 5))
	marcus := s.member("partner", "Marcus", date(1994, 3, 22))
	s.paperwork = &struct{ mother, partner uuid.UUID }{aisha, marcus}
	leo := s.child("Leo", born)
	s.careTeam("obgyn", "Dr. Lena Park", ptr("(617) 555-0133"), nil)
	s.careTeam("pediatrician", "Dr. Samuel Ortiz", ptr("(617) 555-0164"), ptr("Harborview Pediatrics, Boston, MA"))
	s.careTeam("lactation", "Grace Whitfield, IBCLC", ptr("(617) 555-0190"), nil)
	s.careTeam("birth_clinic", "Bayside Birth Center", nil, ptr("Boston, MA"))
	s.lab(parent(aisha), aisha, "family", "gbs", born.AddDate(0, 0, -25), `{"result": "negative"}`)
	s.childAllergy(leo, aisha, "family", "Cow's milk protein", "suspected", "Spit-up and rash after formula", today.AddDate(0, 0, -10))
	s.lab(childOf(leo), aisha, "family", "newborn_screen", born.AddDate(0, 0, 1), `{"result": "normal", "hearing": "pass"}`)
	s.lab(childOf(leo), aisha, "family", "growth", born.AddDate(0, 0, 30),
		`{"weight_kg": 4.6, "length_cm": 55.0, "head_cm": 37.5}`)
	s.vaccine(parent(aisha), "tdap", born.AddDate(0, 0, -70))
	s.vaccine(parent(marcus), "tdap", born.AddDate(0, 0, -40))
	s.vaccine(childOf(leo), "hepb", born)
	for _, m := range []struct{ daysAgo, mood, energy int }{{1, 3, 2}, {3, 3, 2}, {5, 4, 3}} {
		s.mood(aisha, "partner", m.daysAgo, m.mood, m.energy, 5.5, "")
	}
	s.mood(marcus, "private", 1, 2, 1, 4.5, "Back at work, nights are rough.")
	s.mood(marcus, "private", 2, 2, 2, 4, "")
	s.mood(marcus, "private", 4, 2, 2, 5, "")
	return s.done()
}

// Rachel (mother) and Tom (partner) with Ava, who turned 4 last month.
// Ava's vaccines stop at the 15 to 18 month doses, so the 4-to-6-year
// boosters are next, and no vision screening is on file yet.
func seedPreschool(ctx context.Context, q *store.Queries, today time.Time) (uuid.UUID, error) {
	born := today.AddDate(-4, -1, 0)
	s := newSeeder(ctx, q, today, Preschool, "preschool", nil)
	rachel := s.member("mother", "Rachel", date(1989, 6, 9))
	tom := s.member("partner", "Tom", date(1987, 12, 14))
	ava := s.child("Ava", born)
	s.careTeam("pediatrician", "Dr. Nadia Rahman", ptr("(720) 555-0147"), ptr("Foothills Children's Clinic, Denver, CO"))
	s.careTeam("primary_care", "Dr. Oliver Grant", ptr("(720) 555-0102"), nil)
	s.lab(childOf(ava), rachel, "family", "lead_screen", born.AddDate(2, 0, 3), `{"blood_lead_ug_dl": 1.2}`)
	s.lab(childOf(ava), rachel, "family", "growth", born.AddDate(4, 0, 2), `{"weight_kg": 16.3, "height_cm": 102.5}`)
	for _, v := range []struct {
		name   string
		months int
	}{
		{"hepb", 0}, {"hepb", 2}, {"dtap", 2}, {"ipv", 2}, {"dtap", 4}, {"ipv", 4},
		{"dtap", 6}, {"hepb", 6}, {"ipv", 6}, {"mmr", 12}, {"varicella", 12}, {"dtap", 15},
	} {
		s.vaccine(childOf(ava), v.name, born.AddDate(0, v.months, 0))
	}
	s.childAllergy(ava, rachel, "family", "Peanut", "confirmed", "Hives within minutes", born.AddDate(2, 0, 0))
	s.childAllergy(ava, tom, "partner", "Egg", "suspected", "Rash after scrambled eggs", today.AddDate(0, -3, 0))
	s.vaccine(childOf(ava), "flu", today.AddDate(0, 0, -400))
	s.vaccine(parent(rachel), "flu", today.AddDate(0, 0, -15))
	s.vaccine(parent(tom), "tdap", today.AddDate(-5, 0, 0))
	for _, m := range []struct{ daysAgo, mood int }{{1, 4}, {2, 3}, {4, 4}, {6, 3}} {
		s.mood(rachel, "partner", m.daysAgo, m.mood, 3, 7, "")
	}
	s.mood(tom, "partner", 3, 4, 4, 7.5, "")
	return s.done()
}
