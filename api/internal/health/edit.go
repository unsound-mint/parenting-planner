package health

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Editing and removing health records. The write rule lives in the SQL (see
// the comment above UpdateLabValue): a record about the acting parent or about
// a child of the family. Anything else matches no row and is ErrNotFound.

const entityAllergy = "allergy"

func trimmedOrNil(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

// screeningName validates a screening kind and returns the name to store: the
// trimmed free text for kind other, nil for catalog kinds.
func screeningName(kind string, name *string) (*string, error) {
	if kind == ScreeningOther {
		n := trimmedOrNil(name)
		if n == nil {
			return nil, ErrBadScreening
		}
		return n, nil
	}
	if !KnownScreening(kind) {
		return nil, ErrBadScreening
	}
	return nil, nil
}

type LabEdit struct {
	ID              uuid.UUID
	Name, Unit      string
	Value           float64
	RefLow, RefHigh *float64
	TakenOn         time.Time
	Visibility      access.Visibility
}

// UpdateLabValue replaces a lab value. The kind follows the name, and the flag
// is computed from the stored range on read, so it follows the new numbers.
func UpdateLabValue(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, today time.Time, in LabEdit) (store.LabResult, error) {
	if err := checkDate(in.TakenOn, today); err != nil {
		return store.LabResult{}, err
	}
	if in.RefLow != nil && in.RefHigh != nil && *in.RefLow > *in.RefHigh {
		return store.LabResult{}, ErrBadRange
	}
	name, unit, value := strings.TrimSpace(in.Name), strings.TrimSpace(in.Unit), in.Value
	if name == "" || unit == "" {
		return store.LabResult{}, ErrBlank
	}
	var out store.LabResult
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		l, err := q.UpdateLabValue(ctx, store.UpdateLabValueParams{
			ID: in.ID, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true},
			Kind: LabKind(name), Name: &name, Value: &value, Unit: &unit, RefLow: in.RefLow, RefHigh: in.RefHigh,
			TakenOn: in.TakenOn, Visibility: string(in.Visibility),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		out = l
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityLabResult, l.ID.String())
	})
	return out, err
}

func DeleteLabValue(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	return deleteAudited(ctx, pool, familyID, actor, entityLabResult, id, func(q *store.Queries) (int64, error) {
		return q.DeleteLabValue(ctx, store.DeleteLabValueParams{ID: id, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true}})
	})
}

type ScreeningEdit struct {
	ID         uuid.UUID
	Kind       string
	Name       *string
	TakenOn    time.Time
	Visibility access.Visibility
}

func UpdateScreening(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, today time.Time, in ScreeningEdit) (store.LabResult, error) {
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
		l, err := q.UpdateScreening(ctx, store.UpdateScreeningParams{
			ID: in.ID, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true},
			Kind: in.Kind, Name: name, TakenOn: in.TakenOn, Visibility: string(in.Visibility),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		out = l
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityLabResult, l.ID.String())
	})
	return out, err
}

func DeleteScreening(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	return deleteAudited(ctx, pool, familyID, actor, entityLabResult, id, func(q *store.Queries) (int64, error) {
		return q.DeleteScreening(ctx, store.DeleteScreeningParams{ID: id, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true}})
	})
}

// deleteAudited runs del in a transaction; no deleted row is ErrNotFound and
// writes no audit row.
func deleteAudited(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, entity string, id uuid.UUID, del func(*store.Queries) (int64, error)) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := del(q)
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNotFound
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entity, id.String())
	})
}

type NewAllergy struct {
	Subject    Subject
	Substance  string
	Certainty  string
	Reaction   *string
	Visibility access.Visibility
}

// CreateAllergy records an allergy for the acting parent or a child.
func CreateAllergy(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, today time.Time, in NewAllergy) (store.Allergy, error) {
	substance := strings.TrimSpace(in.Substance)
	if substance == "" {
		return store.Allergy{}, ErrBlank
	}
	var out store.Allergy
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := checkSubject(ctx, q, familyID, in.Subject); err != nil {
			return err
		}
		member, child := in.Subject.ids(actor)
		a, err := q.CreateAllergy(ctx, store.CreateAllergyParams{
			FamilyID: familyID, SubjectMemberID: member, SubjectChildID: child, OwnerMemberID: actor,
			Visibility: string(in.Visibility), Substance: substance, Certainty: in.Certainty,
			Reaction: trimmedOrNil(in.Reaction), NotedOn: &today,
		})
		if err != nil {
			return err
		}
		out = a
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityAllergy, a.ID.String())
	})
	return out, err
}

type AllergyEdit struct {
	ID         uuid.UUID
	Substance  string
	Certainty  string
	Reaction   *string
	Visibility access.Visibility
}

// UpdateAllergy keeps noted_on: it is when the allergy was first recorded.
func UpdateAllergy(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in AllergyEdit) (store.Allergy, error) {
	substance := strings.TrimSpace(in.Substance)
	if substance == "" {
		return store.Allergy{}, ErrBlank
	}
	var out store.Allergy
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		a, err := q.UpdateAllergy(ctx, store.UpdateAllergyParams{
			ID: in.ID, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true},
			Substance: substance, Certainty: in.Certainty, Reaction: trimmedOrNil(in.Reaction), Visibility: string(in.Visibility),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		out = a
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityAllergy, a.ID.String())
	})
	return out, err
}

func DeleteAllergy(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	return deleteAudited(ctx, pool, familyID, actor, entityAllergy, id, func(q *store.Queries) (int64, error) {
		return q.DeleteAllergy(ctx, store.DeleteAllergyParams{ID: id, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true}})
	})
}

type ImmunizationEdit struct {
	ID      uuid.UUID
	Vaccine string
	Dose    *string
	GivenOn time.Time
}

// UpdateImmunization replaces a given dose. Immunizations carry no owner or
// visibility (the passport shows them to both parents), so no audit row.
func UpdateImmunization(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, today time.Time, in ImmunizationEdit) (store.Immunization, error) {
	if err := checkDate(in.GivenOn, today); err != nil {
		return store.Immunization{}, err
	}
	im, err := store.New(pool).UpdateImmunization(ctx, store.UpdateImmunizationParams{
		ID: in.ID, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true},
		Vaccine: in.Vaccine, Dose: trimmedOrNil(in.Dose), GivenOn: in.GivenOn,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return store.Immunization{}, ErrNotFound
	}
	return im, err
}

func DeleteImmunization(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	n, err := store.New(pool).DeleteImmunization(ctx, store.DeleteImmunizationParams{
		ID: id, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true},
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// DBCareRole maps a contract CareRole to care_team.role.
func DBCareRole(role string) string {
	switch role {
	case "obstetrician":
		return "obgyn"
	case "lactation_consultant":
		return "lactation"
	}
	return role
}

type NewCareTeamMember struct {
	Subject       Subject
	Name, Role    string
	Clinic, Phone *string
}

// CreateCareTeamMember adds a clinician for the acting parent or a child.
func CreateCareTeamMember(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewCareTeamMember) (store.CareTeam, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return store.CareTeam{}, ErrBlank
	}
	var out store.CareTeam
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := checkSubject(ctx, q, familyID, in.Subject); err != nil {
			return err
		}
		member, child := in.Subject.ids(actor)
		c, err := q.CreateCareTeamMemberFor(ctx, store.CreateCareTeamMemberForParams{
			FamilyID: familyID, Role: DBCareRole(in.Role), Name: name,
			Clinic: trimmedOrNil(in.Clinic), Phone: trimmedOrNil(in.Phone),
			SubjectMemberID: member, SubjectChildID: child,
		})
		out = c
		return err
	})
	return out, err
}

type CareTeamEdit struct {
	ID            uuid.UUID
	Name, Role    string
	Clinic, Phone *string
}

func UpdateCareTeamMember(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in CareTeamEdit) (store.CareTeam, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return store.CareTeam{}, ErrBlank
	}
	c, err := store.New(pool).UpdateCareTeamMember(ctx, store.UpdateCareTeamMemberParams{
		ID: in.ID, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true},
		Name: name, Role: DBCareRole(in.Role), Clinic: trimmedOrNil(in.Clinic), Phone: trimmedOrNil(in.Phone),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return store.CareTeam{}, ErrNotFound
	}
	return c, err
}

func DeleteCareTeamMember(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	n, err := store.New(pool).DeleteCareTeamMember(ctx, store.DeleteCareTeamMemberParams{
		ID: id, FamilyID: familyID, ActorID: uuid.NullUUID{UUID: actor, Valid: true},
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
