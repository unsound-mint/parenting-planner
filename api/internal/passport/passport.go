// Package passport assembles the family health passport: labs, vaccines,
// allergies, growth and care team per person, as one parent may see them.
//
// Follows the wellbeing reference module: one transaction, sensitive lists
// through *VisibleToParent queries (mirroring access.CanParentReadHealthRecord)
// and an access.Audit read row for each sensitive entity.
package passport

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/health"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const (
	entityLabResult = "lab_result"
	entityAllergy   = "allergy"
)

// DueWindow is how far ahead a scheduled dose counts as due rather than upcoming.
const DueWindow = 30 * 24 * time.Hour

type VaccineStatus string

const (
	Done     VaccineStatus = "done"
	Overdue  VaccineStatus = "overdue"
	Due      VaccineStatus = "due"
	Upcoming VaccineStatus = "upcoming"
)

// Vaccine is a dose given (from immunizations) or expected (from vaccine_schedule).
type Vaccine struct {
	ID      uuid.UUID
	Vaccine string
	Dose    string
	Status  VaccineStatus
	GivenOn *time.Time
	DueOn   *time.Time
}

// Person is one passport entry. Exactly one of MemberID and ChildID is set.
type Person struct {
	MemberID  uuid.UUID
	ChildID   uuid.UUID
	Name      string
	Role      string // mother or partner; empty for a child
	BirthDate *time.Time
	IsViewer  bool
	Labs      []store.LabResult // newest first
	// Screenings are lab records without a single value, newest first.
	Screenings []store.LabResult
	// ScreeningOptions is the catalog for this person's stage, to log against.
	ScreeningOptions []health.ScreeningGroup
	Vaccines         []Vaccine // by date, given or due
	Allergies        []store.Allergy
	Growth           []store.GrowthMeasurement // child only, oldest first
	CareTeam         []store.CareTeam
}

func (p Person) IsChild() bool { return p.ChildID != uuid.Nil }

// Get returns the passport for viewer: viewer first, then the other parent,
// then the children by birth date.
func Get(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, today time.Time) ([]Person, error) {
	var people []Person
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		var err error
		people, err = Read(ctx, store.New(tx), familyID, viewer, today)
		return err
	})
	return people, err
}

// Read is Get inside the caller's transaction, audit rows included. The data
// export uses it so the whole export is one transaction.
func Read(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, today time.Time) ([]Person, error) {
	var people []Person
	members, err := q.ListMembers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	children, err := q.ListChildren(ctx, familyID)
	if err != nil {
		return nil, err
	}
	labs, err := q.ListPassportLabsVisibleToParent(ctx, store.ListPassportLabsVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
	if err != nil {
		return nil, err
	}
	screenings, err := q.ListPassportScreeningsVisibleToParent(ctx, store.ListPassportScreeningsVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
	if err != nil {
		return nil, err
	}
	family, err := q.GetFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	allergies, err := q.ListAllergiesVisibleToParent(ctx, store.ListAllergiesVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
	if err != nil {
		return nil, err
	}
	given, err := q.ListImmunizations(ctx, familyID)
	if err != nil {
		return nil, err
	}
	scheduled, err := q.ListScheduledDoses(ctx, familyID)
	if err != nil {
		return nil, err
	}
	growth, err := q.ListGrowthMeasurements(ctx, familyID)
	if err != nil {
		return nil, err
	}
	team, err := q.ListCareTeam(ctx, familyID)
	if err != nil {
		return nil, err
	}

	people = assemble(viewer, members, children, today)
	at := index(people)
	var motherID uuid.UUID
	for _, m := range members {
		if m.Role == "mother" {
			motherID = m.ID
		}
	}
	for _, l := range labs {
		if i, ok := at[subject(l.SubjectMemberID, l.SubjectChildID)]; ok {
			people[i].Labs = append(people[i].Labs, l)
		}
	}
	for _, l := range screenings {
		if i, ok := at[subject(l.SubjectMemberID, l.SubjectChildID)]; ok {
			people[i].Screenings = append(people[i].Screenings, l)
		}
	}
	for i := range people {
		p := &people[i]
		p.ScreeningOptions = health.ScreeningOptions(health.ScreeningSubject{
			Child: p.IsChild(), Mother: p.Role == "mother", Stage: family.Stage,
			AgeMonths: ageMonths(p.BirthDate, today),
		})
	}
	for _, a := range allergies {
		if i, ok := at[subject(a.SubjectMemberID, a.SubjectChildID)]; ok {
			people[i].Allergies = append(people[i].Allergies, a)
		}
	}
	for _, g := range growth {
		if i, ok := at[g.ChildID]; ok {
			people[i].Growth = append(people[i].Growth, g)
		}
	}
	addVaccines(people, at, given, scheduled, today)
	for _, c := range team {
		for _, id := range careTeamSubjects(c, motherID, children) {
			i, ok := at[id]
			if !ok {
				continue
			}
			// Mental health care is the parent's own business: the
			// other parent does not see who their psychologist is.
			if c.Role == "psychologist" && !people[i].IsChild() && !people[i].IsViewer {
				continue
			}
			people[i].CareTeam = append(people[i].CareTeam, c)
		}
	}

	if err := access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityLabResult, ""); err != nil {
		return nil, err
	}
	return people, access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityAllergy, "")
}

func assemble(viewer uuid.UUID, members []store.Member, children []store.Child, today time.Time) []Person {
	var out []Person
	for _, m := range members {
		if m.ID == viewer {
			out = append(out, Person{MemberID: m.ID, Name: m.DisplayName, Role: m.Role, BirthDate: m.BirthDate, IsViewer: true})
		}
	}
	for _, m := range members {
		if m.ID != viewer && (m.Role == "mother" || m.Role == "partner") {
			out = append(out, Person{MemberID: m.ID, Name: m.DisplayName, Role: m.Role, BirthDate: m.BirthDate})
		}
	}
	for _, c := range children {
		b := c.BirthDate
		out = append(out, Person{ChildID: c.ID, Name: c.Name, BirthDate: &b})
	}
	for i := range out {
		out[i].Labs = []store.LabResult{}
		out[i].Screenings = []store.LabResult{}
		out[i].Vaccines = []Vaccine{}
		out[i].Allergies = []store.Allergy{}
		out[i].Growth = []store.GrowthMeasurement{}
		out[i].CareTeam = []store.CareTeam{}
	}
	return out
}

func index(people []Person) map[uuid.UUID]int {
	at := map[uuid.UUID]int{}
	for i, p := range people {
		if p.IsChild() {
			at[p.ChildID] = i
		} else {
			at[p.MemberID] = i
		}
	}
	return at
}

func subject(member, child uuid.NullUUID) uuid.UUID {
	if member.Valid {
		return member.UUID
	}
	return child.UUID
}

func addVaccines(people []Person, at map[uuid.UUID]int, given []store.Immunization, scheduled []store.VaccineSchedule, today time.Time) {
	type doseKey struct {
		subject       uuid.UUID
		vaccine, dose string
	}
	done := map[doseKey]bool{}
	for _, g := range given {
		s := subject(g.SubjectMemberID, g.SubjectChildID)
		dose := ""
		if g.Dose != nil {
			dose = *g.Dose
		}
		done[doseKey{s, g.Vaccine, dose}] = true
		if i, ok := at[s]; ok {
			on := g.GivenOn
			people[i].Vaccines = append(people[i].Vaccines, Vaccine{ID: g.ID, Vaccine: g.Vaccine, Dose: dose, Status: Done, GivenOn: &on})
		}
	}
	for _, d := range scheduled {
		s := subject(d.SubjectMemberID, d.SubjectChildID)
		if done[doseKey{s, d.Vaccine, d.Dose}] {
			continue
		}
		if i, ok := at[s]; ok {
			on := d.DueOn
			people[i].Vaccines = append(people[i].Vaccines, Vaccine{ID: d.ID, Vaccine: d.Vaccine, Dose: d.Dose, Status: ScheduleStatus(d.DueOn, today), DueOn: &on})
		}
	}
	for i := range people {
		v := people[i].Vaccines
		sort.SliceStable(v, func(a, b int) bool { return v[a].date().Before(v[b].date()) })
	}
}

func (v Vaccine) date() time.Time {
	if v.GivenOn != nil {
		return *v.GivenOn
	}
	return *v.DueOn
}

// ScheduleStatus is the status of a dose not yet given: overdue after its due
// day, due within DueWindow, upcoming after that.
func ScheduleStatus(dueOn, today time.Time) VaccineStatus {
	switch {
	case dueOn.Before(today):
		return Overdue
	case !dueOn.After(today.Add(DueWindow)):
		return Due
	default:
		return Upcoming
	}
}

// careTeamSubjects is who a care team row belongs to: its subject when set,
// otherwise the person the role usually cares for.
func careTeamSubjects(c store.CareTeam, motherID uuid.UUID, children []store.Child) []uuid.UUID {
	if c.SubjectMemberID.Valid || c.SubjectChildID.Valid {
		return []uuid.UUID{subject(c.SubjectMemberID, c.SubjectChildID)}
	}
	switch c.Role {
	case "obgyn", "midwife", "lactation", "doula":
		if motherID != uuid.Nil {
			return []uuid.UUID{motherID}
		}
	case "pediatrician":
		ids := make([]uuid.UUID, 0, len(children))
		for _, ch := range children {
			ids = append(ids, ch.ID)
		}
		return ids
	}
	return nil
}

// ageMonths is whole months from birth to today; 0 without a birth date.
func ageMonths(birth *time.Time, today time.Time) int {
	if birth == nil {
		return 0
	}
	m := (today.Year()-birth.Year())*12 + int(today.Month()-birth.Month())
	if today.Day() < birth.Day() {
		m--
	}
	return max(m, 0)
}
