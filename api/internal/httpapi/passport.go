package httpapi

import (
	"context"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/health"
	"github.com/unsound-mint/parenting-planner/api/internal/passport"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func (s *Server) GetPassport(ctx context.Context, req GetPassportRequestObject) (GetPassportResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetPassport401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetPassport404JSONResponse(errNoMember), nil
	}
	today := s.today(ctx)
	people, err := passport.Get(ctx, s.pool, familyID, req.MemberId, today)
	if err != nil {
		return nil, err
	}
	out := Passport{MemberId: req.MemberId, People: make([]PassportPerson, 0, len(people))}
	for _, p := range people {
		out.People = append(out.People, passportPersonOut(p, today))
	}
	return GetPassport200JSONResponse(out), nil
}

func passportPersonOut(p passport.Person, today time.Time) PassportPerson {
	out := PassportPerson{
		Id: p.MemberID, Kind: PassportPersonKindParent, Name: p.Name, IsActingParent: p.IsViewer,
		Labs: make([]LabResult, 0, len(p.Labs)), Vaccines: make([]VaccineDose, 0, len(p.Vaccines)),
		Allergies: make([]Allergy, 0, len(p.Allergies)), Growth: make([]GrowthPoint, 0, len(p.Growth)),
		CareTeam:         make([]CareTeamMember, 0, len(p.CareTeam)),
		Screenings:       make([]Screening, 0, len(p.Screenings)),
		ScreeningOptions: make([]ScreeningOptionGroup, 0, len(p.ScreeningOptions)),
	}
	if p.IsChild() {
		out.Id, out.Kind = p.ChildID, PassportPersonKindChild
		age := monthsBetween(*p.BirthDate, today)
		out.AgeMonths = &age
	} else {
		role := ParentRole(p.Role)
		out.Role = &role
	}
	for _, l := range p.Labs {
		out.Labs = append(out.Labs, labOut(l))
	}
	for _, l := range p.Screenings {
		out.Screenings = append(out.Screenings, screeningOut(l))
	}
	for _, g := range p.ScreeningOptions {
		og := ScreeningOptionGroup{Label: g.Label, Options: make([]ScreeningOption, 0, len(g.Options))}
		for _, o := range g.Options {
			og.Options = append(og.Options, ScreeningOption{Kind: ScreeningKind(o.Kind), Name: o.Name})
		}
		out.ScreeningOptions = append(out.ScreeningOptions, og)
	}
	for _, v := range p.Vaccines {
		d := VaccineDose{Id: v.ID, Name: vaccineName(v.Vaccine), Dose: v.Dose, Status: VaccineStatus(v.Status), Visibility: VisibilityFamily}
		d.GivenOn, d.DueOn = optDate(v.GivenOn), optDate(v.DueOn)
		out.Vaccines = append(out.Vaccines, d)
	}
	for _, a := range p.Allergies {
		out.Allergies = append(out.Allergies, allergyOut(a))
	}
	for _, g := range p.Growth {
		out.Growth = append(out.Growth, growthOut(g, store.Child{BirthDate: *p.BirthDate}))
	}
	for _, c := range p.CareTeam {
		if m, ok := careTeamOut(c); ok {
			out.CareTeam = append(out.CareTeam, m)
		}
	}
	return out
}

func labOut(l store.LabResult) LabResult {
	out := LabResult{
		Id: l.ID, Name: l.Kind, Value: float32(*l.Value), TakenOn: openapi_types.Date{Time: l.TakenOn},
		Visibility: Visibility(l.Visibility), RefLow: optFloat(l.RefLow), RefHigh: optFloat(l.RefHigh),
	}
	if l.Name != nil {
		out.Name = *l.Name
	}
	if l.Unit != nil {
		out.Unit = *l.Unit
	}
	// Computed from the row the viewer may read, so it follows the same visibility.
	if dir, ok := rules.LabOutOfRange(*l.Value, l.RefLow, l.RefHigh); ok {
		unit := ""
		if l.Unit != nil {
			unit = *l.Unit
		}
		out.Flag = &LabFlag{
			Direction: LabFlagDirection(dir), Message: rules.LabFlagMessage, Basis: rules.LabFlagBasis,
			Reason: rules.LabFlagReason(*l.Value, unit, l.RefLow, l.RefHigh, dir),
		}
	}
	return out
}

func screeningOut(l store.LabResult) Screening {
	out := Screening{
		Id: l.ID, Kind: ScreeningKind(l.Kind), Name: health.ScreeningName(l.Kind, l.Name),
		TakenOn: openapi_types.Date{Time: l.TakenOn}, Visibility: Visibility(l.Visibility),
	}
	if l.SubjectChildID.Valid {
		out.ChildId = &l.SubjectChildID.UUID
	}
	return out
}

func allergyOut(a store.Allergy) Allergy {
	return Allergy{
		Id: a.ID, Substance: a.Substance, Certainty: AllergyCertainty(a.Certainty),
		Reaction: a.Reaction, NotedOn: optDate(a.NotedOn), Visibility: Visibility(a.Visibility),
	}
}

// careRoles maps care_team.role to the contract. Roles that are not one
// person's clinician (birth_clinic, doula) are not listed in the passport.
var careRoles = map[string]CareRole{
	"obgyn":        CareRoleObstetrician,
	"midwife":      CareRoleMidwife,
	"pediatrician": CareRolePediatrician,
	"primary_care": CareRolePrimaryCare,
	"psychologist": CareRolePsychologist,
	"lactation":    CareRoleLactationConsultant,
	"dentist":      CareRoleDentist,
}

func careTeamOut(c store.CareTeam) (CareTeamMember, bool) {
	role, ok := careRoles[c.Role]
	if !ok {
		return CareTeamMember{}, false
	}
	out := CareTeamMember{Id: c.ID, Name: c.Name, Role: role, Phone: c.Phone}
	switch {
	case c.Clinic != nil:
		out.Clinic = *c.Clinic
	case c.Address != nil:
		out.Clinic = *c.Address
	}
	return out, true
}

// vaccineNames are display names for the vaccine keys the rules use.
var vaccineNames = map[string]string{
	"tdap": "Tdap", "td": "Td", "flu": "Flu", "covid19": "COVID-19", "rsv": "RSV", "hepb": "Hepatitis B",
	"hepa": "Hepatitis A", "dtap": "DTaP", "mmr": "MMR", "varicella": "Varicella", "hib": "Hib",
	"pcv": "Pneumococcal", "ipv": "Polio", "rotavirus": "Rotavirus",
}

func vaccineName(key string) string {
	if n, ok := vaccineNames[key]; ok {
		return n
	}
	return key
}

func optDate(t *time.Time) *openapi_types.Date {
	if t == nil {
		return nil
	}
	return &openapi_types.Date{Time: *t}
}

func optFloat(f *float64) *float32 {
	if f == nil {
		return nil
	}
	v := float32(*f)
	return &v
}
