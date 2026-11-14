package httpapi_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func getPassport(t *testing.T, c *testutil.Client, member uuid.UUID) httpapi.Passport {
	t.Helper()
	var p httpapi.Passport
	c.Get("/api/members/"+member.String()+"/passport", http.StatusOK, &p)
	return p
}

func person(t *testing.T, p httpapi.Passport, id uuid.UUID) httpapi.PassportPerson {
	t.Helper()
	for _, pp := range p.People {
		if pp.Id == id {
			return pp
		}
	}
	t.Fatalf("passport has no person %s", id)
	return httpapi.PassportPerson{}
}

func labNames(labs []httpapi.LabResult) map[string]bool {
	out := map[string]bool{}
	for _, l := range labs {
		out[l.Name] = true
	}
	return out
}

func TestPassportErrors(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/members/"+uuid.NewString()+"/passport", http.StatusUnauthorized, nil)
	c.StartDemo("pregnancy")
	c.Get("/api/members/"+uuid.NewString()+"/passport", http.StatusNotFound, nil)
	c.Get("/api/members/not-a-uuid/passport", http.StatusBadRequest, nil)
}

func TestPassportShowsTheFamilyFromTheDatabase(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	p := getPassport(t, c, mom.Id)
	if p.MemberId != mom.Id || len(p.People) != 2 {
		t.Fatalf("want mom's passport with 2 people (no child yet), got %+v", p)
	}
	if p.People[0].Id != mom.Id || !p.People[0].IsActingParent || p.People[1].Id != partner.Id || p.People[1].IsActingParent {
		t.Fatalf("acting parent must come first: %+v", p.People)
	}
	me := p.People[0]
	if me.Kind != httpapi.PassportPersonKindParent || me.Role == nil || *me.Role != httpapi.ParentRoleMother {
		t.Errorf("mom kind/role wrong: %+v", me)
	}
	if !labNames(me.Labs)["Hemoglobin"] || me.Labs[0].RefLow == nil {
		t.Errorf("mom's labs missing hemoglobin with a reference range: %+v", me.Labs)
	}
	status := map[string]httpapi.VaccineStatus{}
	for _, v := range me.Vaccines {
		status[v.Name] = v.Status
	}
	if status["Flu"] != httpapi.VaccineStatusDone || status["Tdap"] != httpapi.VaccineStatusDue {
		t.Errorf("mom's vaccines: %+v", me.Vaccines)
	}
	certainty := map[string]httpapi.AllergyCertainty{}
	for _, a := range me.Allergies {
		certainty[a.Substance] = a.Certainty
	}
	if certainty["Penicillin"] != httpapi.Confirmed || certainty["Latex"] != httpapi.Suspected {
		t.Errorf("mom's allergies: %+v", me.Allergies)
	}
	if len(me.CareTeam) == 0 || me.CareTeam[0].Role != httpapi.CareRoleObstetrician || me.CareTeam[0].Clinic == "" {
		t.Errorf("mom's care team should start with the obstetrician: %+v", me.CareTeam)
	}
	for _, m := range append(me.CareTeam, p.People[1].CareTeam...) {
		if m.Name == "Riverbend Women's Hospital" {
			t.Errorf("the birth clinic is not a person's clinician: %+v", m)
		}
	}
	if len(me.Growth) != 0 {
		t.Errorf("parents have no growth points: %+v", me.Growth)
	}
}

// The partner sees only what Emily shared; Emily sees all of her own records.
func TestPassportPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	// A psychologist on Emily's care team stays out of Jake's view.
	if _, err := c.Pool.Exec(context.Background(),
		`INSERT INTO care_team (family_id, role, name, clinic, subject_member_id) VALUES ($1, 'psychologist', 'Dr. Ana Ruiz', 'Harbor Counseling', $2)`,
		fam.Id, mom.Id); err != nil {
		t.Fatal(err)
	}

	own := person(t, getPassport(t, c, mom.Id), mom.Id)
	seen := person(t, getPassport(t, c, partner.Id), mom.Id)

	if got := labNames(own.Labs); !got["TSH"] || !got["Vitamin D"] || !got["Ferritin"] || !got["Hemoglobin"] {
		t.Errorf("Emily must see all her labs, got %v", got)
	}
	for _, l := range seen.Labs {
		if l.Visibility != httpapi.VisibilityPartner && l.Visibility != httpapi.VisibilityFamily {
			t.Errorf("partner sees a %s lab: %+v", l.Visibility, l)
		}
	}
	if got := labNames(seen.Labs); len(got) != 2 || !got["Ferritin"] || !got["Hemoglobin"] {
		t.Errorf("partner must see only the shared labs, got %v", got)
	}
	if len(own.Allergies) != 2 || len(seen.Allergies) != 1 || seen.Allergies[0].Substance != "Penicillin" {
		t.Errorf("partner must see only the shared allergy; own %+v, seen %+v", own.Allergies, seen.Allergies)
	}
	hasPsychologist := func(team []httpapi.CareTeamMember) bool {
		for _, m := range team {
			if m.Role == httpapi.CareRolePsychologist {
				return true
			}
		}
		return false
	}
	if !hasPsychologist(own.CareTeam) || hasPsychologist(seen.CareTeam) {
		t.Errorf("psychologist: own %v, seen by partner %v", own.CareTeam, seen.CareTeam)
	}

	// And the other way round: Jake's private fasting glucose stays with him.
	jakeOwn := person(t, getPassport(t, c, partner.Id), partner.Id)
	jakeSeen := person(t, getPassport(t, c, mom.Id), partner.Id)
	if !labNames(jakeOwn.Labs)["Fasting glucose"] || labNames(jakeSeen.Labs)["Fasting glucose"] {
		t.Errorf("Jake's private lab: own %v, seen by Emily %v", jakeOwn.Labs, jakeSeen.Labs)
	}
}

func TestPassportIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	getPassport(t, c, testutil.Parent(t, fam, httpapi.ParentRoleMother).Id)
	for _, entity := range []string{"lab_result", "allergy"} {
		if n := c.AuditCount(fam.Id, "read", entity); n != 1 {
			t.Errorf("read %s audit rows = %d, want 1", entity, n)
		}
	}
}

// Records about the child are open to both parents, with growth and age.
func TestPassportChild(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	ctx := context.Background()
	var child uuid.UUID
	err := c.Pool.QueryRow(ctx, `INSERT INTO children (family_id, name, birth_date) VALUES ($1, 'Ava', '2025-09-10') RETURNING id`, fam.Id).Scan(&child)
	if err != nil {
		t.Fatal(err)
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := c.Pool.Exec(ctx, q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	// Mom's private records about the child.
	exec(`INSERT INTO lab_results (family_id, subject_child_id, owner_member_id, visibility, kind, taken_on, name, value, unit) VALUES ($1, $2, $3, 'private', 'lead', '2026-09-15', 'Lead', 1.2, 'µg/dL')`, fam.Id, child, mom.Id)
	exec(`INSERT INTO allergies (family_id, subject_child_id, owner_member_id, visibility, substance, certainty) VALUES ($1, $2, $3, 'private', 'Egg', 'suspected')`, fam.Id, child, mom.Id)
	exec(`INSERT INTO growth_measurements (family_id, child_id, measured_on, weight_kg, height_cm) VALUES ($1, $2, '2026-09-10', 9.4, 75.5), ($1, $2, '2026-03-10', 7.6, 67.0)`, fam.Id, child)
	exec(`INSERT INTO immunizations (family_id, subject_child_id, vaccine, dose, given_on) VALUES ($1, $2, 'mmr', 'Dose 1 of 2', '2026-09-12')`, fam.Id, child)
	exec(`INSERT INTO vaccine_schedule (family_id, subject_child_id, vaccine, dose, due_on) VALUES ($1, $2, 'mmr', 'Dose 1 of 2', '2026-09-10'), ($1, $2, 'hepa', 'Dose 1 of 2', '2026-10-01')`, fam.Id, child)
	exec(`INSERT INTO care_team (family_id, role, name, clinic) VALUES ($1, 'pediatrician', 'Dr. Priya Nair', 'Little Oaks Pediatrics')`, fam.Id)

	p := getPassport(t, c, partner.Id)
	if len(p.People) != 3 || p.People[2].Id != child {
		t.Fatalf("child must come last: %+v", p.People)
	}
	ava := p.People[2]
	if ava.Kind != httpapi.PassportPersonKindChild || ava.Role != nil || ava.AgeMonths == nil || *ava.AgeMonths != 14 {
		t.Errorf("child kind/age wrong: %+v", ava)
	}
	if len(ava.Labs) != 1 || len(ava.Allergies) != 1 {
		t.Errorf("both parents see the child's records: labs %+v, allergies %+v", ava.Labs, ava.Allergies)
	}
	if len(ava.Growth) != 2 || ava.Growth[0].AgeMonths != 6 || ava.Growth[1].AgeMonths != 12 {
		t.Errorf("growth must be oldest first with ages: %+v", ava.Growth)
	}
	if len(ava.Vaccines) != 2 || ava.Vaccines[0].Status != httpapi.VaccineStatusDone || ava.Vaccines[1].Status != httpapi.VaccineStatusOverdue {
		t.Errorf("given MMR replaces its scheduled dose; hep A is overdue: %+v", ava.Vaccines)
	}
	if len(ava.CareTeam) != 1 || ava.CareTeam[0].Role != httpapi.CareRolePediatrician {
		t.Errorf("pediatrician belongs to the child: %+v", ava.CareTeam)
	}
}
