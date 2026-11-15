package httpapi

import (
	"context"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/passport"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errNoBabyPassport = Error{Code: "forbidden", Message: "this person has no access to the baby passport"}
)

// GetChildPassport is the baby card. Parents get what the family passport
// holds for the child. A grandparent or nanny needs baby_passport and gets the
// profile, pediatrician, allergies and emergency contacts only.
func (s *Server) GetChildPassport(ctx context.Context, req GetChildPassportRequestObject) (GetChildPassportResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetChildPassport401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetChildPassport404JSONResponse(errNoMember), nil
	}
	parent := isParentRole(m.Role)
	if !parent && !slices.Contains(m.Permissions, string(CaregiverPermissionBabyPassport)) {
		return GetChildPassport403JSONResponse(errNoBabyPassport), nil
	}
	today := s.today(ctx)

	var (
		person   passport.Person
		found    bool
		contacts = []EmergencyContact{}
	)
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		parents, err := q.ListMembers(ctx, familyID)
		if err != nil {
			return err
		}
		for _, p := range parents {
			if p.ID != m.ID && p.Phone != nil && *p.Phone != "" {
				contacts = append(contacts, EmergencyContact{Name: p.DisplayName, Relation: "Parent", Phone: *p.Phone})
			}
		}
		if parent {
			// Same rows, same audit entries as the family passport.
			people, err := passport.Read(ctx, q, familyID, m.ID, today)
			if err != nil {
				return err
			}
			for _, p := range people {
				if p.IsChild() && p.ChildID == req.ChildId {
					person, found = p, true
				}
			}
			return nil
		}
		children, err := q.ListChildren(ctx, familyID)
		if err != nil {
			return err
		}
		for _, c := range children {
			if c.ID == req.ChildId {
				b := c.BirthDate
				person, found = passport.Person{ChildID: c.ID, Name: c.Name, BirthDate: &b}, true
			}
		}
		if !found {
			return nil
		}
		// Rows about a child are family-wide, so the viewer id does not narrow them.
		allergies, err := q.ListAllergiesVisibleToParent(ctx, store.ListAllergiesVisibleToParentParams{FamilyID: familyID, ViewerID: m.ID})
		if err != nil {
			return err
		}
		for _, a := range allergies {
			if a.SubjectChildID.Valid && a.SubjectChildID.UUID == person.ChildID {
				person.Allergies = append(person.Allergies, a)
			}
		}
		team, err := q.ListCareTeam(ctx, familyID)
		if err != nil {
			return err
		}
		for _, c := range team {
			if c.Role == "pediatrician" && (!c.SubjectChildID.Valid || c.SubjectChildID.UUID == person.ChildID) {
				person.CareTeam = append(person.CareTeam, c)
			}
		}
		return access.Audit(ctx, q, familyID, m.ID, access.ActionRead, "allergy", "")
	})
	if err != nil {
		return nil, err
	}
	if !found {
		return GetChildPassport404JSONResponse(errNoChild), nil
	}

	out := ChildPassport{
		Child: Child{
			Id: person.ChildID, Name: person.Name, BirthDate: *optDate(person.BirthDate),
			AgeMonths: monthsBetween(*person.BirthDate, today),
		},
		LimitedView:       !parent,
		Allergies:         make([]Allergy, 0, len(person.Allergies)),
		EmergencyContacts: contacts,
	}
	for _, a := range person.Allergies {
		out.Allergies = append(out.Allergies, allergyOut(a))
	}
	for _, c := range person.CareTeam {
		if tm, ok := careTeamOut(c); ok && tm.Role == CareRolePediatrician {
			out.Pediatrician = &tm
			break
		}
	}
	if parent {
		history := make([]MedicalHistoryEntry, 0, len(person.Screenings))
		for _, sc := range person.Screenings {
			e := screeningOut(sc)
			history = append(history, MedicalHistoryEntry{Date: e.TakenOn, Title: e.Name, Detail: e.Summary})
		}
		vaccines := make([]VaccineDose, 0, len(person.Vaccines))
		for _, v := range person.Vaccines {
			d := VaccineDose{Id: v.ID, Name: vaccineName(v.Vaccine), Dose: v.Dose, Status: VaccineStatus(v.Status), Visibility: VisibilityFamily}
			d.GivenOn, d.DueOn = optDate(v.GivenOn), optDate(v.DueOn)
			vaccines = append(vaccines, d)
		}
		out.MedicalHistory, out.Vaccines = &history, &vaccines
	}
	return GetChildPassport200JSONResponse(out), nil
}
