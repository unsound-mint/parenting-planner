package demo

// The planning, newborn and preschool families. Each one differs from the
// others in stage, children, labs, vaccines, care team and mood history, so
// the same rules produce a different plan, timeline and passport for each.
// All names, clinics and doctors are invented.

import (
	"context"
	_ "embed"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/storybook"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
	"github.com/unsound-mint/parenting-planner/api/internal/thanks"
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
	stage string
	err   error
	// paperwork, when set, seeds the paperwork checklist for these parents at the end.
	paperwork *struct{ mother, partner uuid.UUID }
}

func newSeeder(ctx context.Context, q *store.Queries, today time.Time, t Template, stage string, due *time.Time) *seeder {
	s := &seeder{ctx: ctx, q: q, today: today, stage: stage}
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

func (s *seeder) growth(child uuid.UUID, on time.Time, kg, cm float64, headCm *float64) {
	if s.err != nil {
		return
	}
	_, s.err = s.q.CreateGrowthMeasurement(s.ctx, store.CreateGrowthMeasurementParams{
		FamilyID: s.fam, ChildID: child, MeasuredOn: on, WeightKg: kg, HeightCm: cm, HeadCm: headCm,
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

// visit is a past appointment both parents went to, visible to the family,
// so the calendar and Our story show it with both avatars.
func (s *seeder) visit(owner, with uuid.UUID, title string, on time.Time) {
	if s.err != nil {
		return
	}
	e, err := s.q.CreateCalendarEvent(s.ctx, store.CreateCalendarEventParams{
		FamilyID: s.fam, OwnerMemberID: owner, Visibility: "family", Kind: "appointment", Title: title,
		StartsAt: atHour(on, 15),
	})
	if s.err = err; err == nil {
		s.err = s.q.AddCalendarEventAttendee(s.ctx, store.AddCalendarEventAttendeeParams{EventID: e.ID, MemberID: with})
	}
}

func (s *seeder) learning(t Template, mom, dad uuid.UUID) {
	if s.err == nil {
		s.err = seedLearning(s.ctx, s.q, t, s.fam, mom, dad, s.today)
	}
}

func (s *seeder) missions(t Template, mom, dad uuid.UUID) {
	if s.err == nil {
		s.err = seedMissions(s.ctx, s.q, t, s.fam, mom, dad, s.today)
	}
}

func (s *seeder) done() (uuid.UUID, error) {
	if s.err == nil {
		s.err = seedCaregivers(s.ctx, s.q, s.fam)
	}
	if s.err == nil {
		s.err = seedMoney(s.ctx, s.q, s.fam, s.stage, s.today)
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
	s.missions(Planning, maya, daniel)
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
	// Leo came four days before his due date. Baby is home keeps the due
	// date, so a family that lived through the pregnancy in the app looks
	// the same, and Our story can open with the pregnancy weeks.
	due := born.AddDate(0, 0, 4)
	s := newSeeder(ctx, q, today, Newborn, "postpartum", &due)
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
	// Birth, the two-week check and the one-month visit, so the growth chart has a line.
	s.growth(leo, born, 3.4, 50.5, ptr(34.5))
	s.growth(leo, born.AddDate(0, 0, 14), 3.6, 52.0, ptr(35.5))
	s.growth(leo, born.AddDate(0, 0, 30), 4.6, 55.0, ptr(37.5))
	s.vaccine(parent(aisha), "tdap", born.AddDate(0, 0, -70))
	s.vaccine(parent(marcus), "tdap", born.AddDate(0, 0, -40))
	s.vaccine(childOf(leo), "hepb", born)
	s.visit(aisha, marcus, "Leo's first checkup with Dr. Ortiz", born.AddDate(0, 0, 5))
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
	s.missions(Newborn, aisha, marcus)
	fam, err := s.done()
	if err != nil {
		return uuid.Nil, err
	}
	if err := tasks.SeedBabyTasks(ctx, q, fam, aisha, marcus, today); err != nil {
		return uuid.Nil, err
	}
	if err := seedCareHistory(ctx, q, fam, leo, aisha, marcus, today); err != nil {
		return uuid.Nil, err
	}
	if err := seedBabyCare(ctx, q, fam, leo, aisha, marcus, today); err != nil {
		return uuid.Nil, err
	}
	if err := seedRecovery(ctx, q, fam, aisha, marcus, today); err != nil {
		return uuid.Nil, err
	}
	// From bump to baby: Aisha's bump, then Leo at birth and at one month. His
	// two-month portrait, due in under two weeks, is the next one to take.
	if err := bumpWeeks(ctx, q, fam, born, 12, 20, 28, 36); err != nil {
		return uuid.Nil, err
	}
	if err := childMonths(ctx, q, fam, leo, born, 0, 1); err != nil {
		return uuid.Nil, err
	}
	if err := seedChildcare(ctx, q, fam, today); err != nil {
		return uuid.Nil, err
	}
	// A finished picture book, shared with Marcus, so the storybook shelf is not empty.
	if err := storybook.Seed(ctx, q, fam, aisha, leo, "Leo", born, today, storybook.Born, "Mommy", access.Partner, 3,
		"You held my finger the whole first night and would not let go",
		"Daddy sang the same silly song again and again, and you went quiet to listen",
		"Grandma Linda knitted you a yellow hat that was much too big",
	); err != nil {
		return uuid.Nil, err
	}
	return fam, nil
}

// seedChildcare gives the newborn family three childcare options in different
// states: a daycare place offered for when Leo is 4 months, with an answer due
// in 10 days (an upcoming "Decide on a childcare offer" plan item); a daycare
// waitlist; and a nanny share they are still researching. All invented.
func seedChildcare(ctx context.Context, q *store.Queries, fam uuid.UUID, today time.Time) error {
	cost := func(v int32) pgtype.Int4 { return pgtype.Int4{Int32: v, Valid: true} }
	day := func(n int) *time.Time { d := today.AddDate(0, 0, n); return &d }
	at := func(n, h int) time.Time { return today.AddDate(0, 0, n).Add(time.Duration(h) * time.Hour) }
	for _, o := range []store.CreateChildcareOptionParams{
		{
			Name: "Little Harbor Early Learning", Kind: "daycare", Contact: ptr("Ms. Rivera, (617) 555-0142"), MonthlyCost: cost(2450),
			Status: "offered", AppliedOn: day(-75), DecideBy: day(10),
			Notes: ptr("Infant room place from when Leo is 4 months. A $500 deposit holds it."), Now: at(-3, 16),
		},
		{
			Name: "Brightwater Children's Center", Kind: "daycare", Contact: ptr("admissions@brightwater.example"), MonthlyCost: cost(2700),
			Status: "waitlisted", WaitlistPosition: cost(6), AppliedOn: day(-90),
			Notes: ptr("Toured before Leo was born. They call when an infant spot opens, likely in spring."), Now: at(-20, 15),
		},
		{
			Name: "Nanny share with the Delgados", Kind: "nanny", Contact: ptr("Priya Delgado, (617) 555-0187"), MonthlyCost: cost(1900),
			Status: "researching", Notes: ptr("Two families, three days a week at our place. Interviewing nannies next week."), Now: at(-2, 19),
		},
	} {
		o.FamilyID = fam
		if _, err := q.CreateChildcareOption(ctx, o); err != nil {
			return err
		}
	}
	return nil
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
		{Kind: "feed", StartedAt: at(20, 30), EndedAt: span(20, 30, 25), FeedMethod: method("breast_both"), AuthorMemberID: aisha},
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

// seedCareHistory gives the two weeks before yesterday a realistic split: Aisha
// does most of the days, and Marcus has picked up the nights since last week
// (two night feeds a night this week, one the week before). The seeded thank-you
// note from Aisha names one of those nights. Nothing is later than now.
func seedCareHistory(ctx context.Context, q *store.Queries, fam, leo, aisha, marcus uuid.UUID, today time.Time) error {
	at := func(daysAgo, h, m int) time.Time {
		return today.AddDate(0, 0, -daysAgo).Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute)
	}
	type row struct {
		h, m   int
		kind   string
		author uuid.UUID
		detail string // feed method or diaper content
		ml     int16  // bottle amount
	}
	for d := 2; d <= 13; d++ {
		rows := []row{
			{8, 0, "feed", aisha, "breast_left", 0}, {13, 0, "feed", aisha, "breast_right", 0}, {18, 30, "feed", marcus, "bottle_breast_milk", 90},
			{8, 30, "diaper", aisha, "wet", 0}, {14, 0, "diaper", aisha, "dirty", 0}, {19, 0, "diaper", marcus, "wet", 0},
		}
		if d <= 6 {
			rows = append(rows, row{23, 30, "feed", aisha, "breast_both", 0}, row{1, 30, "feed", marcus, "bottle_breast_milk", 90}, row{4, 30, "feed", marcus, "bottle_formula", 100})
		} else {
			rows = append(rows, row{23, 30, "feed", aisha, "breast_both", 0}, row{2, 0, "feed", aisha, "breast_left", 0}, row{4, 30, "feed", marcus, "bottle_formula", 100})
		}
		for _, r := range rows {
			e := store.CreateCareLogEntryParams{FamilyID: fam, ChildID: leo, AuthorMemberID: r.author, Kind: r.kind, StartedAt: at(d, r.h, r.m)}
			detail := r.detail
			if r.kind == "feed" {
				e.FeedMethod = &detail
			} else {
				e.Diaper = &detail
			}
			if r.ml > 0 {
				e.AmountMl = pgtype.Int2{Int16: r.ml, Valid: true}
			}
			if _, err := q.CreateCareLogEntry(ctx, e); err != nil {
				return err
			}
		}
		// Naps and the night's stretches between feeds, a few minutes different each day,
		// so the week view shows a pattern. Sleeps are nobody's work: the load map and
		// thank-you suggestions skip them.
		jit := (d * 7) % 20
		for _, sl := range []struct{ h, m, mins int }{{0, 0, 80}, {2, 10, 130}, {5, 0, 150}, {9, 0, 100}, {13, 30, 85}, {15, 40, 45}, {19, 30, 225}} {
			start := at(d, sl.h, sl.m+jit)
			e := store.CreateCareLogEntryParams{
				FamilyID: fam, ChildID: leo, AuthorMemberID: aisha, Kind: "sleep", StartedAt: start,
				EndedAt: pgtype.Timestamptz{Time: start.Add(time.Duration(sl.mins-jit/2) * time.Minute), Valid: true},
			}
			if _, err := q.CreateCareLogEntry(ctx, e); err != nil {
				return err
			}
		}
	}
	// The night that started three days ago: Marcus did the 01:30 and 04:30 feeds.
	night := today.AddDate(0, 0, -3)
	return thanks.Seed(ctx, q, fam, aisha, marcus, "Thank you for the 2 night feeds on "+night.Weekday().String()+". I slept five hours in a row.",
		thanks.Key("night_feeds", marcus, night), today.AddDate(0, 0, -2).Add(8*time.Hour))
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
	// The yearly well-child visits.
	for i, g := range []struct{ kg, cm float64 }{{3.3, 50.0}, {9.4, 75.0}, {12.2, 87.0}, {14.3, 96.0}, {16.3, 102.5}} {
		s.growth(ava, born.AddDate(i, 0, 2), g.kg, g.cm, nil)
	}
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
	s.visit(rachel, tom, "Ava's 4-year checkup with Dr. Rahman", born.AddDate(4, 0, 2))
	s.vaccine(parent(rachel), "flu", today.AddDate(0, 0, -15))
	s.vaccine(parent(tom), "tdap", today.AddDate(-5, 0, 0))
	for _, m := range []struct{ daysAgo, mood int }{{1, 4}, {2, 3}, {4, 4}, {6, 3}} {
		s.mood(rachel, "partner", m.daysAgo, m.mood, 3, 7, "")
	}
	s.mood(tom, "partner", 3, 4, 4, 7.5, "")
	s.learning(Preschool, rachel, tom)
	s.missions(Preschool, rachel, tom)
	fam, err := s.done()
	if err != nil {
		return uuid.Nil, err
	}
	// Ava at birth, six months and every birthday so far.
	if err := childMonths(ctx, q, fam, ava, born, 0, 6, 12, 24, 36, 48); err != nil {
		return uuid.Nil, err
	}
	// Tom's bedtime book is shared with Rachel; Rachel's adventure is still private,
	// so each parent's shelf shows a different pair.
	if err := storybook.Seed(ctx, q, fam, tom, ava, "Ava", born, today, storybook.Bedtime, "Daddy", access.Partner, 6,
		"You fed the ducks and laughed when one of them sneezed",
		"We built a blanket fort and you invited every stuffed animal you own",
		"You named the brightest star over the porch Pancake",
	); err != nil {
		return uuid.Nil, err
	}
	if err := storybook.Seed(ctx, q, fam, rachel, ava, "Ava", born, today, storybook.Adventure, "Mommy", access.Private, 2,
		"You climbed the big hill all by yourself and shouted hello to the clouds",
		"You found a snail and gave it a leaf for lunch",
	); err != nil {
		return uuid.Nil, err
	}
	return fam, nil
}

// seedRecovery gives Aisha five recovery check-ins over the last two weeks, getting
// better, and the baby supplies: diapers are low (about three days left by the care
// log), the rest is fine. One check-in is shared with Marcus; the others are private.
func seedRecovery(ctx context.Context, q *store.Queries, fam, aisha, marcus uuid.UUID, today time.Time) error {
	mood := func(v int16) pgtype.Int2 { return pgtype.Int2{Int16: v, Valid: true} }
	note := func(v string) *string { return &v }
	for _, c := range []struct {
		daysAgo                               int
		vis, bleeding, wound, breasts, pelvic string
		pain                                  int16
		sleep                                 float32
		mood                                  int16
		note                                  *string
	}{
		{13, "private", "light", "sore", "sore", "leaking", 5, 4.5, 2, note("Sitting is still uncomfortable.")},
		{9, "private", "light", "sore", "full", "leaking", 4, 5, 3, nil},
		{6, "private", "spotting", "healing_well", "comfortable", "leaking", 3, 5.5, 3, nil},
		{3, "partner", "spotting", "healing_well", "comfortable", "fine", 2, 6, 4, note("A good stretch of sleep. Marcus did the night shift.")},
		{1, "private", "none", "healing_well", "comfortable", "fine", 2, 5.5, 4, nil},
	} {
		if _, err := q.CreateRecoveryCheckin(ctx, store.CreateRecoveryCheckinParams{
			FamilyID: fam, OwnerMemberID: aisha, Visibility: c.vis, RecordedAt: today.AddDate(0, 0, -c.daysAgo).Add(20 * time.Hour),
			Bleeding: c.bleeding, Pain: c.pain, Wound: c.wound, Breasts: c.breasts, PelvicFloor: c.pelvic,
			SleepHours: c.sleep, Mood: mood(c.mood), WarningSigns: []string{}, Note: c.note,
		}); err != nil {
			return err
		}
	}
	item := func(name, category string, qty, lowAt int32, unit string, perUse int16, size *string, expires *time.Time) (store.SupplyItem, error) {
		return q.CreateSupplyItem(ctx, store.CreateSupplyItemParams{FamilyID: fam, Name: name, Category: category, Quantity: qty, Unit: unit, LowAt: lowAt, PerUse: perUse, Size: size, ExpiresOn: expires})
	}
	diapers, err := item("Diapers", "diapers", 11, 12, "diapers", 1, note("Size 2"), nil)
	if err != nil {
		return err
	}
	expires := today.AddDate(0, 5, 0)
	for _, it := range []struct {
		name, category, unit string
		qty, lowAt           int32
		perUse               int16
		size                 *string
		expires              *time.Time
	}{
		{"Wipes", "wipes", "wipes", 180, 60, 3, nil, nil},
		{"Infant formula", "formula", "bottles", 9, 3, 1, nil, nil},
		{"Vitamin D drops", "medicine", "bottle", 1, 0, 1, nil, &expires},
		{"Diaper cream", "medicine", "tube", 1, 0, 1, nil, nil},
		{"Onesies", "clothing", "pcs", 7, 0, 1, note("3-6 months"), nil},
	} {
		if _, err := item(it.name, it.category, it.qty, it.lowAt, it.unit, it.perUse, it.size, it.expires); err != nil {
			return err
		}
	}
	restock := pgtype.Int4{Int32: 40, Valid: true}
	rows := []store.CreateShoppingItemParams{
		{FamilyID: fam, Name: "Diapers, size 2", SupplyItemID: uuid.NullUUID{UUID: diapers.ID, Valid: true}, RestockQuantity: restock, AddedByMemberID: marcus},
		{FamilyID: fam, Name: "Nursing pads", AddedByMemberID: aisha},
		{FamilyID: fam, Name: "Burp cloths", AddedByMemberID: aisha},
	}
	for i, r := range rows {
		row, err := q.CreateShoppingItem(ctx, r)
		if err != nil {
			return err
		}
		if i == 2 { // bought yesterday
			if _, err := q.SetShoppingItemDone(ctx, store.SetShoppingItemDoneParams{
				ID: row.ID, FamilyID: fam, DoneAt: pgtype.Timestamptz{Time: today.AddDate(0, 0, -1).Add(18 * time.Hour), Valid: true}, DoneBy: uuid.NullUUID{UUID: marcus, Valid: true},
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

// SeedRecentCare gives the newborn the hours since midnight (UTC, the seed's
// day) up to now: the yesterday seed alone leaves the Baby screen's last 24
// hours half empty for most of the day. Linda, who has the baby today, logs
// it, so the parents' load map and thank-you counts stay as seeded. Every
// entry is before now. It is a no-op for other templates.
func SeedRecentCare(ctx context.Context, pool *pgxpool.Pool, t Template, familyID uuid.UUID, now time.Time) error {
	if t != Newborn {
		return nil
	}
	q := store.New(pool)
	kids, err := q.ListChildren(ctx, familyID)
	if err != nil || len(kids) == 0 {
		return err
	}
	helpers, err := careHelpers(ctx, q, familyID)
	if err != nil {
		return err
	}
	linda := helpers["grandparent"]
	midnight := now.UTC().Truncate(24 * time.Hour)
	str := func(v string) *string { return &v }
	feeds := []string{"bottle_breast_milk", "breast_right", "bottle_formula", "breast_left"}
	diapers := []string{"wet", "dirty", "wet", "both"}
	// Walking back from now in three-hour rounds: a feed, a diaper, then the sleep before them.
	for i, end := 0, now; end.Sub(midnight) > 3*time.Hour; i, end = i+1, end.Add(-3*time.Hour) {
		feedAt := end.Add(-25 * time.Minute)
		f := store.CreateCareLogEntryParams{FamilyID: familyID, ChildID: kids[len(kids)-1].ID, AuthorMemberID: linda, Kind: "feed", StartedAt: feedAt, FeedMethod: str(feeds[i%len(feeds)])}
		if strings.HasPrefix(feeds[i%len(feeds)], "bottle") {
			f.AmountMl = pgtype.Int2{Int16: 90, Valid: true}
		} else {
			f.EndedAt = pgtype.Timestamptz{Time: feedAt.Add(18 * time.Minute), Valid: true}
		}
		sleepEnd := end.Add(-time.Duration(45+(i*13)%30) * time.Minute)
		rows := []store.CreateCareLogEntryParams{
			f,
			{FamilyID: familyID, ChildID: kids[len(kids)-1].ID, AuthorMemberID: linda, Kind: "diaper", StartedAt: end.Add(-35 * time.Minute), Diaper: str(diapers[i%len(diapers)])},
			{FamilyID: familyID, ChildID: kids[len(kids)-1].ID, AuthorMemberID: linda, Kind: "sleep", StartedAt: sleepEnd.Add(-time.Duration(80+(i*17)%50) * time.Minute), EndedAt: pgtype.Timestamptz{Time: sleepEnd, Valid: true}},
		}
		for _, r := range rows {
			if _, err := q.CreateCareLogEntry(ctx, r); err != nil {
				return err
			}
		}
	}
	return nil
}
