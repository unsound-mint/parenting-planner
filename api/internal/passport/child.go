package passport

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// ErrNoChild: the child is not in the family.
var ErrNoChild = errors.New("no such child in this family")

// ChildCard is the baby passport card. Full (a parent) adds the medical
// history and the vaccines; without it (a caregiver) only the profile,
// pediatrician, allergies and emergency contacts are loaded.
type ChildCard struct {
	Child    Person
	Contacts []store.EmergencyContact
	// History is the child's lab and screening records, newest first. Full only.
	History []store.LabResult
}

// Child loads the card for one child. Reading allergies and, for a parent,
// the medical history is written to audit_log in the same transaction, so a
// caregiver's read shows in the access log.
func Child(ctx context.Context, pool *pgxpool.Pool, familyID, actor, childID uuid.UUID, full bool, today time.Time) (ChildCard, error) {
	var card ChildCard
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		children, err := q.ListChildren(ctx, familyID)
		if err != nil {
			return err
		}
		members, err := q.ListMembers(ctx, familyID)
		if err != nil {
			return err
		}
		people := assemble(actor, members, children, today)
		at := index(people)
		i, ok := at[childID]
		if !ok {
			return ErrNoChild
		}
		child := people[i]

		child.Allergies, err = q.ListChildAllergiesVisibleToParent(ctx, store.ListChildAllergiesVisibleToParentParams{FamilyID: familyID, ChildID: uuid.NullUUID{UUID: childID, Valid: true}})
		if err != nil {
			return err
		}
		team, err := q.ListCareTeam(ctx, familyID)
		if err != nil {
			return err
		}
		var motherID uuid.UUID
		for _, m := range members {
			if m.Role == "mother" {
				motherID = m.ID
			}
		}
		for _, c := range team {
			for _, id := range careTeamSubjects(c, motherID, children) {
				if id == childID {
					child.CareTeam = append(child.CareTeam, c)
				}
			}
		}
		if card.Contacts, err = q.ListEmergencyContacts(ctx, familyID); err != nil {
			return err
		}

		if full {
			labs, err := q.ListLabResultsVisibleToParent(ctx, store.ListLabResultsVisibleToParentParams{FamilyID: familyID, ViewerID: actor})
			if err != nil {
				return err
			}
			for _, l := range labs {
				if l.SubjectChildID.Valid && l.SubjectChildID.UUID == childID {
					card.History = append(card.History, l)
				}
			}
			given, err := q.ListImmunizations(ctx, familyID)
			if err != nil {
				return err
			}
			scheduled, err := q.ListScheduledDoses(ctx, familyID)
			if err != nil {
				return err
			}
			one := []Person{child}
			addVaccines(one, map[uuid.UUID]int{childID: 0}, given, scheduled, today)
			child.Vaccines = one[0].Vaccines
		}
		card.Child = child

		if err := access.Audit(ctx, q, familyID, actor, access.ActionRead, entityAllergy, ""); err != nil {
			return err
		}
		if full {
			return access.Audit(ctx, q, familyID, actor, access.ActionRead, entityLabResult, "")
		}
		return nil
	})
	return card, err
}
