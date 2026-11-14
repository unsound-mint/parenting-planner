// Package health logs health records a parent brings home: vaccine doses,
// screenings and lab values. The plan and the passport read them on the next
// request, so a logged dose or screening removes the matching rule item.
//
// Follows the wellbeing reference module: one transaction per write with an
// access.Audit row. The subject is the acting parent or a child of the same
// family; another parent's records are never written.
package health

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/notify"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const (
	entityImmunization = "immunization"
	entityLabResult    = "lab_result"
)

var (
	// ErrNoChild: the child id is not a child of this family.
	ErrNoChild = errors.New("no such child in this family")
	// ErrFutureDate: the record is dated after today.
	ErrFutureDate = errors.New("date is in the future")
	// ErrBadRange: refLow is above refHigh.
	ErrBadRange = errors.New("reference range is inverted")
	// ErrBlank: the lab name or unit is only spaces.
	ErrBlank = errors.New("name or unit is blank")
	// ErrBadScreening: the kind is not in the catalog, or kind other has no name.
	ErrBadScreening = errors.New("unknown screening kind or missing name")
	// ErrNotFound: no record the acting parent may change has this id.
	ErrNotFound = errors.New("no such record")
)

// Subject is who the record is about: the acting parent, or ChildID when set.
type Subject struct {
	ChildID *uuid.UUID
}

func (s Subject) ids(actor uuid.UUID) (member, child uuid.NullUUID) {
	if s.ChildID != nil {
		return uuid.NullUUID{}, uuid.NullUUID{UUID: *s.ChildID, Valid: true}
	}
	return uuid.NullUUID{UUID: actor, Valid: true}, uuid.NullUUID{}
}

func checkSubject(ctx context.Context, q *store.Queries, familyID uuid.UUID, s Subject) error {
	if s.ChildID == nil {
		return nil
	}
	ok, err := q.ChildInFamily(ctx, store.ChildInFamilyParams{ChildID: *s.ChildID, FamilyID: familyID})
	if err != nil {
		return err
	}
	if !ok {
		return ErrNoChild
	}
	return nil
}

func checkDate(on, today time.Time) error {
	if on.After(today) {
		return ErrFutureDate
	}
	return nil
}

type NewDose struct {
	Subject Subject
	Vaccine string
	Dose    *string
	GivenOn time.Time
}

// LogDose records a vaccine dose. Without a dose label it takes the label of
// the earliest scheduled dose of that vaccine for the subject not yet given,
// so the passport schedule and the plan agree.
func LogDose(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, today time.Time, in NewDose) (store.Immunization, error) {
	if err := checkDate(in.GivenOn, today); err != nil {
		return store.Immunization{}, err
	}
	var out store.Immunization
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := checkSubject(ctx, q, familyID, in.Subject); err != nil {
			return err
		}
		member, child := in.Subject.ids(actor)
		dose := in.Dose
		if dose == nil {
			next, err := q.NextScheduledDose(ctx, store.NextScheduledDoseParams{
				FamilyID: familyID, Vaccine: in.Vaccine, SubjectMemberID: member, SubjectChildID: child,
			})
			switch {
			case err == nil:
				dose = &next
			case !errors.Is(err, pgx.ErrNoRows):
				return err
			}
		}
		im, err := q.CreateGivenDose(ctx, store.CreateGivenDoseParams{
			FamilyID: familyID, SubjectMemberID: member, SubjectChildID: child,
			Vaccine: in.Vaccine, Dose: dose, GivenOn: in.GivenOn,
		})
		if err != nil {
			return err
		}
		out = im
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityImmunization, im.ID.String())
	})
	return out, err
}

type NewScreening struct {
	Subject Subject
	Kind    string
	// Name is the free text for kind other; ignored for catalog kinds.
	Name       *string
	TakenOn    time.Time
	Visibility access.Visibility
}

// LogScreening records a screening as a lab result without a single value,
// which is what the rules read (lab kind on record).
func LogScreening(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, today time.Time, in NewScreening) (store.LabResult, error) {
	if err := checkDate(in.TakenOn, today); err != nil {
		return store.LabResult{}, err
	}
	name, err := screeningName(in.Kind, in.Name)
	if err != nil {
		return store.LabResult{}, err
	}
	var out store.LabResult
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := checkSubject(ctx, q, familyID, in.Subject); err != nil {
			return err
		}
		member, child := in.Subject.ids(actor)
		l, err := q.CreateLabResult(ctx, store.CreateLabResultParams{
			FamilyID: familyID, SubjectMemberID: member, SubjectChildID: child, OwnerMemberID: actor,
			Visibility: string(in.Visibility), Kind: in.Kind, TakenOn: in.TakenOn, Result: []byte("{}"),
			Name: name,
		})
		if err != nil {
			return err
		}
		out = l
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityLabResult, l.ID.String())
	})
	return out, err
}

type NewLabValue struct {
	Subject         Subject
	Name, Unit      string
	Value           float64
	RefLow, RefHigh *float64
	TakenOn         time.Time
	Visibility      access.Visibility
	// Now is the family's clock, for the notification an out-of-range value sends.
	Now time.Time
}

// LogLabValue records one measured lab value. Its kind is the name in
// lowercase with underscores ("Vitamin D" -> vitamin_d). A value outside its
// reference range notifies the people who own the record (notify.LabFlagged).
func LogLabValue(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, today time.Time, in NewLabValue) (store.LabResult, error) {
	if err := checkDate(in.TakenOn, today); err != nil {
		return store.LabResult{}, err
	}
	if in.RefLow != nil && in.RefHigh != nil && *in.RefLow > *in.RefHigh {
		return store.LabResult{}, ErrBadRange
	}
	var out store.LabResult
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := checkSubject(ctx, q, familyID, in.Subject); err != nil {
			return err
		}
		member, child := in.Subject.ids(actor)
		name, unit, value := strings.TrimSpace(in.Name), strings.TrimSpace(in.Unit), in.Value
		if name == "" || unit == "" {
			return ErrBlank
		}
		l, err := q.CreateLabValue(ctx, store.CreateLabValueParams{
			FamilyID: familyID, SubjectMemberID: member, SubjectChildID: child, OwnerMemberID: actor,
			Visibility: string(in.Visibility), Kind: LabKind(name), TakenOn: in.TakenOn,
			Name: &name, Value: &value, Unit: &unit, RefLow: in.RefLow, RefHigh: in.RefHigh,
		})
		if err != nil {
			return err
		}
		out = l
		if _, flagged := rules.LabOutOfRange(value, in.RefLow, in.RefHigh); flagged {
			if err := notify.LabFlagged(ctx, q, familyID, l, actor, in.Now); err != nil {
				return err
			}
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityLabResult, l.ID.String())
	})
	return out, err
}

var nonWord = regexp.MustCompile(`[^a-z0-9]+`)

// LabKind turns a lab name into the kind stored with it.
func LabKind(name string) string {
	k := strings.Trim(nonWord.ReplaceAllString(strings.ToLower(name), "_"), "_")
	if k == "" {
		return "lab"
	}
	return k
}
