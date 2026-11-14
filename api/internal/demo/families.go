package demo

// The planning, newborn and preschool families. Each one differs from the
// others in stage, children, labs, vaccines, care team and mood history, so
// the same rules produce a different plan, timeline and passport for each.
// All names, clinics and doctors are invented.

import (
	"context"
	_ "embed"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
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

// scheduledDose is a dose that is not given yet; the passport lists it as due
// or upcoming from its due date.
func (s *seeder) scheduledDose(sub subject, vaccine, dose string, dueOn time.Time) {
	if s.err != nil {
		return
	}
	m, c := sub.ids()
	_, s.err = s.q.CreateScheduledDose(s.ctx, store.CreateScheduledDoseParams{FamilyID: s.fam, SubjectMemberID: m, SubjectChildID: c, Vaccine: vaccine, Dose: dose, DueOn: dueOn})
}

func (s *seeder) vaccine(sub subject, vaccine string, givenOn time.Time) {
	if s.err != nil {
		return
	}
	m, c := sub.ids()
	_, s.err = s.q.CreateImmunization(s.ctx, store.CreateImmunizationParams{FamilyID: s.fam, SubjectMemberID: m, SubjectChildID: c, Vaccine: vaccine, GivenOn: givenOn})
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

// moodScreening records a scored questionnaire daysAgo days before today.
func (s *seeder) moodScreening(owner uuid.UUID, visibility, instrument string, daysAgo int, answers []int) {
	if s.err != nil {
		return
	}
	sc, err := rules.Score(instrument, answers)
	if err != nil {
		s.err = err
		return
	}
	stored := make([]int16, len(answers))
	for i, a := range answers {
		stored[i] = int16(a)
	}
	_, s.err = s.q.CreateMoodScreening(s.ctx, store.CreateMoodScreeningParams{
		FamilyID: s.fam, OwnerMemberID: owner, Visibility: visibility,
		TakenAt:    s.today.AddDate(0, 0, -daysAgo).Add(14 * time.Hour),
		Instrument: instrument, Answers: stored, Score: int16(sc.Score), Band: string(sc.Band), Urgent: sc.Urgent,
	})
}

func (s *seeder) learning(t Template, mom, dad uuid.UUID) {
	if s.err == nil {
		s.err = seedLearning(s.ctx, s.q, t, s.fam, mom, dad, s.today)
	}
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
	s.fertility(maya, daniel)
	s.learning(Planning, maya, daniel)
	return s.done()
}

// Aisha (mother) and Marcus (partner) are home with Leo, born 7 weeks ago.
// Leo had his birth hepatitis B dose but not the 2-month vaccines; Aisha has
// not had her full postpartum visit; Marcus is sleeping little and logged
// three low days this week (kept private, so only his own plan sees them).
// Aisha took a mood questionnaire two weeks ago (green, private); Marcus has
// not taken one, so his plan asks for it.
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
	s.lab(childOf(leo), aisha, "family", "newborn_screen", born.AddDate(0, 0, 1), `{"result": "normal", "hearing": "pass"}`)
	s.lab(childOf(leo), aisha, "family", "growth", born.AddDate(0, 0, 30),
		`{"weight_kg": 4.6, "length_cm": 55.0, "head_cm": 37.5}`)
	s.vaccine(parent(aisha), "tdap", born.AddDate(0, 0, -70))
	s.vaccine(parent(marcus), "tdap", born.AddDate(0, 0, -40))
	s.vaccine(childOf(leo), "hepb", born)
	// The 2-month visit, so the passport lists the same doses the plan item
	// "infant-2-month-vaccines" asks the parents to book.
	for _, v := range []string{"dtap", "ipv", "hib", "pcv", "rotavirus"} {
		s.scheduledDose(childOf(leo), v, "Dose 1", born.AddDate(0, 2, 0))
	}
	for _, m := range []struct{ daysAgo, mood, energy int }{{1, 3, 2}, {3, 3, 2}, {5, 4, 3}} {
		s.mood(aisha, "partner", m.daysAgo, m.mood, m.energy, 5.5, "")
	}
	s.mood(marcus, "private", 1, 2, 1, 4.5, "Back at work, nights are rough.")
	s.mood(marcus, "private", 2, 2, 2, 4, "")
	s.mood(marcus, "private", 4, 2, 2, 5, "")
	s.moodScreening(aisha, "private", rules.EPDS, 14, []int{1, 1, 1, 1, 0, 1, 0, 0, 0, 0})
	s.learning(Newborn, aisha, marcus)
	fam, err := s.done()
	if err != nil {
		return uuid.Nil, err
	}
	if err := seedBabyCare(ctx, q, fam, leo, aisha, marcus, today); err != nil {
		return uuid.Nil, err
	}
	return fam, nil
}

// handoffTone is three seconds of a generated 440 Hz tone (Ogg Opus), standing
// in for a recording. No real voice.
//
//go:embed handoff-tone.ogg
var handoffTone []byte

// seedBabyCare gives Leo yesterday's feeds, sleeps and diapers, and an accepted
// handoff from Aisha to the grandmother with a voice note, so the Baby screen
// has something to show. Everything is yesterday, never later than now. The
// voice note is inserted with its handoff, so the unattached-note cleanup
// leaves it alone.
func seedBabyCare(ctx context.Context, q *store.Queries, fam, leo, aisha, marcus uuid.UUID, today time.Time) error {
	day := today.AddDate(0, 0, -1)
	at := func(h, m int) time.Time { return day.Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute) }
	span := func(h, m, mins int) pgtype.Timestamptz {
		return pgtype.Timestamptz{Time: at(h, m).Add(time.Duration(mins) * time.Minute), Valid: true}
	}
	method := func(v string) *string { return &v }
	ml := func(v int16) pgtype.Int2 { return pgtype.Int2{Int16: v, Valid: true} }
	helpers, err := careHelpers(ctx, q, fam)
	if err != nil {
		return err
	}
	linda := helpers["grandparent"]
	entries := []store.CreateCareLogEntryParams{
		{Kind: "feed", StartedAt: at(5, 40), EndedAt: span(5, 40, 20), FeedMethod: method("breast_left"), AuthorMemberID: aisha},
		{Kind: "diaper", StartedAt: at(6, 5), Diaper: method("both"), AuthorMemberID: aisha},
		{Kind: "sleep", StartedAt: at(6, 30), EndedAt: span(6, 30, 95), AuthorMemberID: aisha},
		{Kind: "feed", StartedAt: at(8, 20), EndedAt: span(8, 20, 18), FeedMethod: method("breast_right"), AuthorMemberID: aisha},
		{Kind: "diaper", StartedAt: at(8, 45), Diaper: method("wet"), AuthorMemberID: aisha},
		{Kind: "sleep", StartedAt: at(9, 10), EndedAt: span(9, 10, 80), AuthorMemberID: aisha},
		{Kind: "feed", StartedAt: at(11, 30), FeedMethod: method("bottle_breast_milk"), AmountMl: ml(90), AuthorMemberID: marcus},
		{Kind: "diaper", StartedAt: at(11, 55), Diaper: method("dirty"), AuthorMemberID: marcus},
		{Kind: "sleep", StartedAt: at(12, 15), EndedAt: span(12, 15, 110), AuthorMemberID: aisha},
		{Kind: "feed", StartedAt: at(14, 10), FeedMethod: method("bottle_breast_milk"), AmountMl: ml(90), AuthorMemberID: aisha},
		{Kind: "sleep", StartedAt: at(14, 40), EndedAt: span(14, 40, 25), AuthorMemberID: aisha},
		{Kind: "feed", StartedAt: at(17, 15), FeedMethod: method("bottle_formula"), AmountMl: ml(100), AuthorMemberID: linda},
		{Kind: "diaper", StartedAt: at(17, 40), Diaper: method("wet"), AuthorMemberID: linda},
		{Kind: "sleep", StartedAt: at(18, 0), EndedAt: span(18, 0, 60), AuthorMemberID: linda},
		{Kind: "feed", StartedAt: at(20, 30), EndedAt: span(20, 30, 25), FeedMethod: method("breast_left"), AuthorMemberID: aisha},
		{Kind: "diaper", StartedAt: at(21, 0), Diaper: method("both"), AuthorMemberID: aisha},
		{Kind: "sleep", StartedAt: at(21, 15), EndedAt: span(21, 15, 150), AuthorMemberID: aisha},
	}
	for _, e := range entries {
		e.FamilyID, e.ChildID = fam, leo
		if _, err := q.CreateCareLogEntry(ctx, e); err != nil {
			return err
		}
	}
	note := "Fed at 14:10, 90 ml. Napped 14:40 to 15:05. Diaper cream is on the changing table."
	h, err := q.CreateHandoff(ctx, store.CreateHandoffParams{
		FamilyID: fam, FromMemberID: aisha, ToMemberID: linda, Note: &note, CreatedAt: at(15, 0),
	})
	if err != nil {
		return err
	}
	if _, err := q.AcceptHandoff(ctx, store.AcceptHandoffParams{ID: h.ID, AcceptedAt: pgtype.Timestamptz{Time: at(15, 4), Valid: true}}); err != nil {
		return err
	}
	dur := pgtype.Int4{Int32: 3, Valid: true}
	vn, err := q.CreateVoiceNote(ctx, store.CreateVoiceNoteParams{
		FamilyID: fam, UploaderMemberID: aisha, ContentType: "audio/ogg;codecs=opus", SizeBytes: int32(len(handoffTone)),
		DurationSeconds: dur, Audio: handoffTone, CreatedAt: at(14, 58),
	})
	if err != nil {
		return err
	}
	_, err = q.AttachVoiceNoteToHandoff(ctx, store.AttachVoiceNoteToHandoffParams{
		HandoffID: uuid.NullUUID{UUID: h.ID, Valid: true}, VoiceNoteID: vn.ID, FamilyID: fam, UploaderID: aisha,
	})
	return err
}

// careHelpers maps a caregiver's role to their member id.
func careHelpers(ctx context.Context, q *store.Queries, fam uuid.UUID) (map[string]uuid.UUID, error) {
	ms, err := q.ListCaregivers(ctx, fam)
	if err != nil {
		return nil, err
	}
	out := map[string]uuid.UUID{}
	for _, m := range ms {
		out[m.Role] = m.ID
	}
	return out, nil
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
	s.vaccine(childOf(ava), "flu", today.AddDate(0, 0, -400))
	s.vaccine(parent(rachel), "flu", today.AddDate(0, 0, -15))
	s.vaccine(parent(tom), "tdap", today.AddDate(-5, 0, 0))
	for _, m := range []struct{ daysAgo, mood int }{{1, 4}, {2, 3}, {4, 4}, {6, 3}} {
		s.mood(rachel, "partner", m.daysAgo, m.mood, 3, 7, "")
	}
	s.mood(tom, "partner", 3, 4, 4, 7.5, "")
	s.learning(Preschool, rachel, tom)
	return s.done()
}
