package demo

// A family from the visitor's own details ("Try it with your own details").
// It is seeded through the same path as the demo templates and then read by
// the same plan and rules, so everything the visitor sees comes from what
// they typed. Nothing beyond the typed fields is stored.

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Custom is the template of a family built from the visitor's own details.
const Custom Template = "custom"

// ErrBadDetails wraps every reason the typed details do not fit together.
// Its message is safe to show to the visitor.
var ErrBadDetails = errors.New("these details do not fit together")

// Details is what a visitor types.
type Details struct {
	Stage          string
	DueDate        *time.Time
	ChildBirthDate *time.Time
	ChildName      string
	MotherName     string
	PartnerName    string
}

// Age bands in completed months for the stages after birth; the upper bound
// is exclusive. Mirrors the createCustomSession description in openapi.yaml.
var childStages = map[string][2]int{
	"postpartum": {0, 3},
	"infant":     {3, 12},
	"toddler":    {12, 36},
	"preschool":  {36, 60},
	"school_age": {60, 120},
}

// StartCustom creates a family from the visitor's details and opens a session
// for it. It returns the family id and the raw session token for the cookie.
func StartCustom(ctx context.Context, pool *pgxpool.Pool, d Details, today time.Time) (uuid.UUID, string, error) {
	d.MotherName, d.PartnerName, d.ChildName = strings.TrimSpace(d.MotherName), strings.TrimSpace(d.PartnerName), strings.TrimSpace(d.ChildName)
	if !hasLetter(d.MotherName) || !hasLetter(d.PartnerName) {
		return uuid.Nil, "", fmt.Errorf("%w: both parents need a name", ErrBadDetails)
	}
	if d.ChildName != "" && !hasLetter(d.ChildName) {
		d.ChildName = "" // a "-" is not a name; the child is then unnamed
	}
	due, birth, err := d.dates(today)
	if err != nil {
		return uuid.Nil, "", err
	}
	return start(ctx, pool, crypt.Key{}, Custom, func(ctx context.Context, q *store.Queries, today time.Time) (uuid.UUID, error) {
		s := newSeeder(ctx, q, today, Custom, d.Stage, due)
		for _, m := range []store.CreateMemberParams{
			{Role: "mother", DisplayName: d.MotherName},
			{Role: "partner", DisplayName: d.PartnerName},
		} {
			if s.err != nil {
				break
			}
			m.FamilyID = s.fam
			_, s.err = q.CreateMember(ctx, m) // no birth date: it was not asked
		}
		if birth != nil {
			// The web reads "Baby" as "not named" and says "your baby" in
			// prose (givenName in web/src/lib/format.ts).
			name := d.ChildName
			if name == "" {
				name = "Baby"
			}
			s.child(name, *birth)
		}
		return s.done()
	}, today)
}

// dates checks the dates against the stage and returns only the ones the
// stage uses, so a date that does not belong to it is never stored.
func (d Details) dates(today time.Time) (due, birth *time.Time, err error) {
	if d.Stage == "pregnancy" {
		if d.DueDate == nil {
			return nil, nil, fmt.Errorf("%w: a due date is needed during pregnancy", ErrBadDetails)
		}
		dd := day(*d.DueDate)
		if dd.Before(today.AddDate(0, 0, -14)) || dd.After(today.AddDate(0, 0, 280)) {
			return nil, nil, fmt.Errorf("%w: the due date must be between 14 days ago and 280 days from today", ErrBadDetails)
		}
		return &dd, nil, nil
	}
	band, born := childStages[d.Stage]
	if !born {
		return nil, nil, nil // planning and trying need no dates
	}
	if d.ChildBirthDate == nil {
		return nil, nil, fmt.Errorf("%w: the child's birth date is needed for this stage", ErrBadDetails)
	}
	b := day(*d.ChildBirthDate)
	if b.After(today) {
		return nil, nil, fmt.Errorf("%w: the birth date is in the future", ErrBadDetails)
	}
	if m := completedMonths(b, today); m < band[0] || m >= band[1] {
		return nil, nil, fmt.Errorf("%w: a child aged %d months does not fit the stage %s", ErrBadDetails, m, d.Stage)
	}
	return nil, &b, nil
}

func day(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// completedMonths counts whole months, like Child.ageMonths in the API.
func completedMonths(from, to time.Time) int {
	m := (to.Year()-from.Year())*12 + int(to.Month()-from.Month())
	if to.Day() < from.Day() {
		m--
	}
	return max(m, 0)
}

// hasLetter is false for a name like "-" or "...", which reads as a blank on
// every screen that shows it.
func hasLetter(s string) bool {
	return strings.IndexFunc(s, unicode.IsLetter) >= 0
}
