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
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const SessionTTL = 30 * 24 * time.Hour

type Template string

const Pregnancy Template = "pregnancy"

var ErrUnknownTemplate = errors.New("unknown demo template")

var seeds = map[Template]func(ctx context.Context, q *store.Queries, today time.Time) (uuid.UUID, error){
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
	token, hash, err := newToken()
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
		return q.CreateSession(ctx, store.CreateSessionParams{TokenHash: hash, FamilyID: id, ExpiresAt: time.Now().Add(SessionTTL)})
	})
	return familyID, token, err
}

// HashToken is how session tokens are stored and looked up.
func HashToken(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}

func newToken() (string, []byte, error) {
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
	if _, err := q.CreateMember(ctx, store.CreateMemberParams{FamilyID: fam.ID, Role: "partner", DisplayName: "Jake", BirthDate: ptr(time.Date(1991, 9, 3, 0, 0, 0, 0, time.UTC))}); err != nil {
		return uuid.Nil, err
	}
	for _, c := range []store.CreateCareTeamMemberParams{
		{FamilyID: fam.ID, Role: "obgyn", Name: "Dr. Priya Shah", Phone: ptr("(512) 555-0142")},
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
	return fam.ID, nil
}
