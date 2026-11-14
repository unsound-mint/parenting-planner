// Package demo creates fresh copies of synthetic families for visitors.
// No login: each visitor gets their own family, so nobody sees another
// visitor's changes. Dates are relative to today so the demo never goes stale.
// docs/demo-script.md depends on this data; update both together.
package demo

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/notify"
	"github.com/unsound-mint/parenting-planner/api/internal/offers"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

const SessionTTL = 30 * 24 * time.Hour

type Template string

const Pregnancy Template = "pregnancy"

var ErrUnknownTemplate = errors.New("unknown demo template")

type seedFunc func(ctx context.Context, q *store.Queries, today time.Time) (uuid.UUID, error)

var seeds = map[Template]seedFunc{
	Planning:  seedPlanning,
	Pregnancy: seedPregnancy,
	Newborn:   seedNewborn,
	Preschool: seedPreschool,
}

// Start seeds a family from the template and opens a session for it.
// It returns the family id and the raw session token for the cookie.
func Start(ctx context.Context, pool *pgxpool.Pool, t Template, today time.Time) (uuid.UUID, string, error) {
	seed, ok := seeds[t]
	if !ok {
		return uuid.Nil, "", ErrUnknownTemplate
	}
	return start(ctx, pool, seed, today)
}

// start runs a seed and opens a session for its family in one transaction.
// Demo templates and families from a visitor's own details both go through it.
func start(ctx context.Context, pool *pgxpool.Pool, seed seedFunc, today time.Time) (uuid.UUID, string, error) {
	token, hash, err := NewToken()
	if err != nil {
		return uuid.Nil, "", err
	}
	var familyID uuid.UUID
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		id, err := seed(ctx, q, today)
		if err != nil {
			return err
		}
		familyID = id
		// Every family, from a template or a visitor's own details, gets its
		// own copy of the partner offers for the admin panel to edit.
		if err := offers.Seed(ctx, q, id, today); err != nil {
			return err
		}
		return q.CreateSession(ctx, store.CreateSessionParams{TokenHash: hash, FamilyID: id, ExpiresAt: time.Now().Add(SessionTTL)})
	})
	return familyID, token, err
}

// seedCaregivers adds the two helpers every demo family has: a grandmother and
// a nanny. They see the baby's care, never a parent's health data.
func seedCaregivers(ctx context.Context, q *store.Queries, familyID uuid.UUID) error {
	for _, c := range []store.CreateCaregiverParams{
		{FamilyID: familyID, Role: "grandparent", DisplayName: "Linda", Permissions: []string{"care_log", "baby_passport", "schedule", "pregnancy_updates"}},
		{FamilyID: familyID, Role: "nanny", DisplayName: "Maria", Permissions: []string{"care_log", "baby_passport", "schedule"}},
	} {
		if _, err := q.CreateCaregiver(ctx, c); err != nil {
			return err
		}
	}
	// People to call about the baby, shown on the baby passport card. Invented.
	for _, c := range []store.CreateEmergencyContactParams{
		{FamilyID: familyID, Name: "Linda", Relation: "Grandmother", Phone: "(512) 555-0171"},
		{FamilyID: familyID, Name: "Robert", Relation: "Uncle", Phone: "(512) 555-0188"},
	} {
		if _, err := q.CreateEmergencyContact(ctx, c); err != nil {
			return err
		}
	}
	return nil
}

// SkipDays is how far one "Skip ahead a week" moves a family's demo clock.
const SkipDays = 7

// SkipWeek moves one family's demo clock SkipDays ahead. Only that family's
// row changes; a new demo is a new family, which starts at real time.
func SkipWeek(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) error {
	_, err := store.New(pool).SkipFamilyDemoClock(ctx, store.SkipFamilyDemoClockParams{Days: SkipDays, ID: familyID})
	return err
}

// HashToken is how session tokens are stored and looked up.
func HashToken(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}

func NewToken() (string, []byte, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", nil, err
	}
	t := hex.EncodeToString(b)
	return t, HashToken(t), nil
}

func ptr[T any](v T) *T { return &v }

// Emily (mother) and Jake (partner), first baby, 25 weeks pregnant.
// No glucose screening or Tdap yet, so both parents see different, real plan items.
func seedPregnancy(ctx context.Context, q *store.Queries, today time.Time) (uuid.UUID, error) {
	const week = 25
	due := today.AddDate(0, 0, 280-week*7)
	fam, err := q.CreateFamily(ctx, store.CreateFamilyParams{Template: string(Pregnancy), Stage: "pregnancy", DueDate: &due})
	if err != nil {
		return uuid.Nil, err
	}
	mom, err := q.CreateMember(ctx, store.CreateMemberParams{FamilyID: fam.ID, Role: "mother", DisplayName: "Emily", BirthDate: ptr(time.Date(1993, 4, 12, 0, 0, 0, 0, time.UTC))})
	if err != nil {
		return uuid.Nil, err
	}
	partner, err := q.CreateMember(ctx, store.CreateMemberParams{FamilyID: fam.ID, Role: "partner", DisplayName: "Jake", BirthDate: ptr(time.Date(1991, 9, 3, 0, 0, 0, 0, time.UTC))})
	if err != nil {
		return uuid.Nil, err
	}
	if _, err := q.CreateCareTeamMemberFor(ctx, store.CreateCareTeamMemberForParams{
		FamilyID: fam.ID, Role: "obgyn", Name: "Dr. Priya Shah", Clinic: ptr("Riverbend Women's Health"), Phone: ptr("(512) 555-0142"),
		SubjectMemberID: uuid.NullUUID{UUID: mom.ID, Valid: true},
	}); err != nil {
		return uuid.Nil, err
	}
	for _, c := range []store.CreateCareTeamMemberParams{
		{FamilyID: fam.ID, Role: "birth_clinic", Name: "Riverbend Women's Hospital", Address: ptr("Austin, TX")},
	} {
		if _, err := q.CreateCareTeamMember(ctx, c); err != nil {
			return uuid.Nil, err
		}
	}
	// First-trimester labs, shared with the family.
	if _, err := q.CreateLabResult(ctx, store.CreateLabResultParams{
		FamilyID: fam.ID, SubjectMemberID: uuid.NullUUID{UUID: mom.ID, Valid: true}, OwnerMemberID: mom.ID,
		Visibility: "family", Kind: "prenatal_panel", TakenOn: today.AddDate(0, 0, -(week-9)*7),
		Result: []byte(`{"hemoglobin_g_dl": 12.4, "blood_type": "O+", "rubella": "immune"}`),
	}); err != nil {
		return uuid.Nil, err
	}

	// Emily's last week: two low, short-sleep days just before today, so one
	// more low check-in completes the three-day pattern (demo-script step 4).
	// Jake has no check-ins (demo-script step 2).
	for _, c := range []struct {
		daysAgo    int
		mood       int16
		energy     int16
		sleep      float64
		visibility string
		note       *string
	}{
		{6, 4, 4, 7.5, "partner", ptr("Good prenatal class with Jake.")},
		{4, 3, 3, 6.5, "private", nil},
		{2, 2, 2, 5, "private", ptr("Back pain kept me up. Worried about the birth.")},
		{1, 2, 2, 5.5, "private", nil},
	} {
		if _, err := q.CreateMoodCheckin(ctx, store.CreateMoodCheckinParams{
			FamilyID: fam.ID, OwnerMemberID: mom.ID, Visibility: c.visibility,
			RecordedAt: today.AddDate(0, 0, -c.daysAgo).Add(21 * time.Hour),
			Mood:       c.mood, Energy: c.energy, SleepHours: c.sleep, Note: c.note,
		}); err != nil {
			return uuid.Nil, err
		}
	}
	if err := seedPsychologist(ctx, q, fam.ID, mom.ID, today); err != nil {
		return uuid.Nil, err
	}
	if err := seedPregnancyPassport(ctx, q, fam.ID, mom.ID, partner.ID, today, week); err != nil {
		return uuid.Nil, err
	}
	if err := seedCaregivers(ctx, q, fam.ID); err != nil {
		return uuid.Nil, err
	}
	if err := tasks.SeedPaperwork(ctx, q, fam.ID, mom.ID, partner.ID, nil, today); err != nil {
		return uuid.Nil, err
	}
	if err := tasks.SeedHospitalBag(ctx, q, fam.ID, mom.ID, partner.ID); err != nil {
		return uuid.Nil, err
	}
	if err := seedAppointments(ctx, q, fam.ID, mom.ID, partner.ID, today); err != nil {
		return uuid.Nil, err
	}
	if err := tasks.SeedPlanTasks(ctx, q, fam.ID, mom.ID, partner.ID, today); err != nil {
		return uuid.Nil, err
	}
	return fam.ID, nil
}

// seedPsychologist opens slots with the demo psychologist on weekdays at 10:00
// and 15:00 Eastern (15:00 and 20:00 UTC) for the session's whole lifetime,
// and gives the mother a session two days ago with no note yet, so the care
// screen asks for one and the note changes her plan.
func seedPsychologist(ctx context.Context, q *store.Queries, familyID, motherID uuid.UUID, today time.Time) error {
	p, err := q.GetDemoPsychologist(ctx)
	if err != nil {
		return err
	}
	slot := func(day time.Time, hourUTC int) store.CreatePsychologistSlotParams {
		return store.CreatePsychologistSlotParams{
			FamilyID: familyID, PsychologistID: p.ID, DurationMinutes: 50,
			StartsAt: time.Date(day.Year(), day.Month(), day.Day(), hourUTC, 0, 0, 0, time.UTC),
		}
	}
	days := int(SessionTTL/(24*time.Hour)) + 5
	for i := 0; i <= days; i++ {
		d := today.AddDate(0, 0, i)
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}
		for _, h := range []int{15, 20} {
			if _, err := q.CreatePsychologistSlot(ctx, slot(d, h)); err != nil {
				return err
			}
		}
	}
	past := slot(today.AddDate(0, 0, -2), 15)
	pastID, err := q.CreatePsychologistSlot(ctx, past)
	if err != nil {
		return err
	}
	// The slot is in the past, so book it as of the day before it started.
	_, err = q.CreatePsychologistBooking(ctx, store.CreatePsychologistBookingParams{
		OwnerMemberID: motherID, SlotID: pastID, FamilyID: familyID, Now: past.StartsAt.Add(-24 * time.Hour),
	})
	return err
}

// seedPregnancyPassport fills the health passport. Some of Emily's records are
// private so the partner's view shows the access rules at work. Ferritin and
// vitamin D sit below their range, so the passport flags them and Emily's bell
// has a value_flagged notification for each (the older one read). No glucose,
// GBS or Tdap rows: the plan expects them missing.
func seedPregnancyPassport(ctx context.Context, q *store.Queries, familyID, mom, partner uuid.UUID, today time.Time, week int) error {
	member := func(id uuid.UUID) uuid.NullUUID { return uuid.NullUUID{UUID: id, Valid: true} }

	for _, c := range []store.CreateCareTeamMemberForParams{
		{FamilyID: familyID, Role: "primary_care", Name: "Dr. Marcus Bell", Clinic: ptr("Eastside Family Practice"), Phone: ptr("(512) 555-0187"), SubjectMemberID: member(partner)},
		{FamilyID: familyID, Role: "primary_care", Name: "Dr. Lena Ortiz", Clinic: ptr("Eastside Family Practice"), Phone: ptr("(512) 555-0187"), SubjectMemberID: member(mom)},
	} {
		if _, err := q.CreateCareTeamMemberFor(ctx, c); err != nil {
			return err
		}
	}

	firstVisit := today.AddDate(0, 0, -(week-9)*7)
	var flagged []store.LabResult
	for _, l := range []store.CreateLabValueParams{
		{SubjectMemberID: member(mom), OwnerMemberID: mom, Visibility: "family", Kind: "hemoglobin", TakenOn: firstVisit, Name: ptr("Hemoglobin"), Value: ptr(12.4), Unit: ptr("g/dL"), RefLow: ptr(11.0), RefHigh: ptr(15.0)},
		{SubjectMemberID: member(mom), OwnerMemberID: mom, Visibility: "partner", Kind: "ferritin", TakenOn: firstVisit, Name: ptr("Ferritin"), Value: ptr(12.0), Unit: ptr("ng/mL"), RefLow: ptr(15.0), RefHigh: ptr(150.0)},
		{SubjectMemberID: member(mom), OwnerMemberID: mom, Visibility: "private", Kind: "tsh", TakenOn: firstVisit, Name: ptr("TSH"), Value: ptr(1.8), Unit: ptr("mIU/L"), RefLow: ptr(0.4), RefHigh: ptr(4.0)},
		{SubjectMemberID: member(mom), OwnerMemberID: mom, Visibility: "private", Kind: "vitamin_d", TakenOn: today.AddDate(0, 0, -30), Name: ptr("Vitamin D"), Value: ptr(24.0), Unit: ptr("ng/mL"), RefLow: ptr(30.0), RefHigh: ptr(100.0)},
		{SubjectMemberID: member(partner), OwnerMemberID: partner, Visibility: "partner", Kind: "cholesterol", TakenOn: today.AddDate(0, -5, 0), Name: ptr("Total cholesterol"), Value: ptr(182.0), Unit: ptr("mg/dL"), RefLow: ptr(125.0), RefHigh: ptr(200.0)},
		{SubjectMemberID: member(partner), OwnerMemberID: partner, Visibility: "private", Kind: "glucose_fasting", TakenOn: today.AddDate(0, -5, 0), Name: ptr("Fasting glucose"), Value: ptr(88.0), Unit: ptr("mg/dL"), RefLow: ptr(70.0), RefHigh: ptr(99.0)},
	} {
		l.FamilyID = familyID
		row, err := q.CreateLabValue(ctx, l)
		if err != nil {
			return err
		}
		if _, out := rules.LabOutOfRange(*l.Value, l.RefLow, l.RefHigh); out {
			flagged = append(flagged, row)
		}
	}
	// Notified a few days apart, before today; Emily has read the first one.
	for i, l := range flagged {
		at := today.AddDate(0, 0, i*2-len(flagged)*2).Add(14 * time.Hour)
		if err := notify.LabFlagged(ctx, q, familyID, l, mom, at); err != nil {
			return err
		}
		if i == 0 {
			if err := q.MarkAllNotificationsRead(ctx, store.MarkAllNotificationsReadParams{
				ReadAt: pgtype.Timestamptz{Time: at.Add(time.Hour), Valid: true}, FamilyID: familyID, RecipientID: mom,
			}); err != nil {
				return err
			}
		}
	}

	for _, d := range []store.CreateGivenDoseParams{
		{SubjectMemberID: member(mom), Vaccine: "flu", Dose: ptr("This season"), GivenOn: today.AddDate(0, 0, -40)},
		{SubjectMemberID: member(partner), Vaccine: "flu", Dose: ptr("This season"), GivenOn: today.AddDate(0, 0, -33)},
	} {
		d.FamilyID = familyID
		if _, err := q.CreateGivenDose(ctx, d); err != nil {
			return err
		}
	}
	pregnancyStart := today.AddDate(0, 0, -week*7)
	for _, d := range []store.CreateScheduledDoseParams{
		{SubjectMemberID: member(mom), Vaccine: "tdap", Dose: "This pregnancy", DueOn: pregnancyStart.AddDate(0, 0, 27*7)},
		{SubjectMemberID: member(partner), Vaccine: "tdap", Dose: "Before the baby arrives", DueOn: today.AddDate(0, 0, 21)},
	} {
		d.FamilyID = familyID
		if _, err := q.CreateScheduledDose(ctx, d); err != nil {
			return err
		}
	}

	for _, a := range []store.CreateAllergyParams{
		{SubjectMemberID: member(mom), OwnerMemberID: mom, Visibility: "family", Substance: "Penicillin", Certainty: "confirmed", Reaction: ptr("Rash"), NotedOn: ptr(time.Date(2015, 6, 2, 0, 0, 0, 0, time.UTC))},
		{SubjectMemberID: member(mom), OwnerMemberID: mom, Visibility: "private", Substance: "Latex", Certainty: "suspected", Reaction: ptr("Itchy hands after gloves"), NotedOn: ptr(today.AddDate(0, -2, 0))},
		{SubjectMemberID: member(partner), OwnerMemberID: partner, Visibility: "partner", Substance: "Shellfish", Certainty: "suspected", Reaction: ptr("Tingling lips after shrimp"), NotedOn: ptr(today.AddDate(0, -8, 0))},
	} {
		a.FamilyID = familyID
		if _, err := q.CreateAllergy(ctx, a); err != nil {
			return err
		}
	}
	return nil
}

// seedAppointments gives the mother a past and an upcoming OB visit (Jake comes to the
// next one) with questions: one left unanswered at the past visit, so it carries over.
func seedAppointments(ctx context.Context, q *store.Queries, familyID, mom, partner uuid.UUID, today time.Time) error {
	visit := func(title string, days int) (uuid.UUID, error) {
		e, err := q.CreateCalendarEvent(ctx, store.CreateCalendarEventParams{
			FamilyID: familyID, OwnerMemberID: mom, Visibility: "family", Kind: "appointment", Title: title,
			StartsAt: today.AddDate(0, 0, days).Add(10 * time.Hour),
		})
		if err != nil {
			return uuid.Nil, err
		}
		if days > 0 {
			err = q.AddCalendarEventAttendee(ctx, store.AddCalendarEventAttendeeParams{EventID: e.ID, MemberID: partner})
		}
		return e.ID, err
	}
	past, err := visit("OB visit with Dr. Shah", -14)
	if err != nil {
		return err
	}
	next, err := visit("OB visit with Dr. Shah", 9)
	if err != nil {
		return err
	}
	for _, aq := range []struct {
		event      uuid.UUID
		text, vis  string
		answeredAt *time.Time
	}{
		{past, "Is the back pain normal at this stage?", "partner", nil},
		{past, "When do we sign up for the birth class?", "family", ptr(today.AddDate(0, 0, -14).Add(11 * time.Hour))},
		{next, "When should I schedule the glucose screening?", "private", nil},
		{next, "Which vaccines does Jake need before the birth?", "family", nil},
	} {
		created, err := q.CreateAppointmentQuestion(ctx, store.CreateAppointmentQuestionParams{
			FamilyID: familyID, OwnerMemberID: mom, Visibility: aq.vis, AskedForEventID: aq.event, Body: aq.text,
		})
		if err != nil {
			return err
		}
		if aq.answeredAt != nil {
			if _, err := q.AnswerAppointmentQuestionVisibleToParent(ctx, store.AnswerAppointmentQuestionVisibleToParentParams{
				ID: created.ID, FamilyID: familyID, ViewerID: mom, Answered: true, Answer: ptr("At the next visit, the clinic will hand out the schedule."),
				AnsweredAt: pgtype.Timestamptz{Time: *aq.answeredAt, Valid: true},
			}); err != nil {
				return err
			}
		}
	}
	return nil
}
