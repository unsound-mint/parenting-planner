package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func childPassportPath(person, child uuid.UUID) string {
	return "/api/members/" + person.String() + "/children/" + child.String() + "/passport"
}

func substances(p httpapi.ChildPassport) map[string]httpapi.AllergyCertainty {
	out := map[string]httpapi.AllergyCertainty{}
	for _, a := range p.Allergies {
		out[a.Substance] = a.Certainty
	}
	return out
}

func TestParentsSeeTheWholeBabyPassport(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	child := fam.Children[0]
	for _, parent := range []httpapi.Parent{mom, dad} {
		var p httpapi.ChildPassport
		c.Get(childPassportPath(parent.Id, child.Id), http.StatusOK, &p)
		if p.LimitedView || p.Child.Id != child.Id || p.Child.Name != "Ava" || p.Child.AgeMonths < 48 {
			t.Fatalf("child = %+v limited=%v", p.Child, p.LimitedView)
		}
		if p.Pediatrician == nil || p.Pediatrician.Name != "Dr. Nadia Rahman" || p.Pediatrician.Role != httpapi.CareRolePediatrician {
			t.Errorf("pediatrician = %+v", p.Pediatrician)
		}
		if got := substances(p); got["Peanut"] != httpapi.Confirmed || got["Egg"] != httpapi.Suspected || len(got) != 2 {
			t.Errorf("allergies = %v", got)
		}
		if len(p.EmergencyContacts) != 2 || p.EmergencyContacts[0].Relation != "Grandmother" {
			t.Errorf("emergency contacts = %+v", p.EmergencyContacts)
		}
		if p.MedicalHistory == nil || len(*p.MedicalHistory) < 2 || p.Vaccines == nil || len(*p.Vaccines) == 0 {
			t.Fatalf("a parent gets the history and vaccines: %+v", p)
		}
		h := *p.MedicalHistory
		if h[0].Date.Before(h[1].Date.Time) {
			t.Errorf("medical history must be newest first: %v then %v", h[0].Date, h[1].Date)
		}
	}
}

func TestCaregiversSeeALimitedBabyPassport(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	child := fam.Children[0]
	var nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleNanny {
			nanny = cg
		}
	}
	var p httpapi.ChildPassport
	c.Get(childPassportPath(nanny.Id, child.Id), http.StatusOK, &p)
	if !p.LimitedView || p.MedicalHistory != nil || p.Vaccines != nil {
		t.Fatalf("a nanny gets no medical history or vaccines: %+v", p)
	}
	// Safety information is shown whatever visibility the parent chose, suspected or confirmed.
	if got := substances(p); got["Peanut"] != httpapi.Confirmed || got["Egg"] != httpapi.Suspected {
		t.Errorf("the nanny must see both allergies: %v", got)
	}
	if p.Pediatrician == nil || len(p.EmergencyContacts) != 2 {
		t.Errorf("pediatrician and emergency contacts are shown: %+v", p)
	}

	// The read is in the access log; the history, which she did not see, is not.
	if n := c.AuditCount(fam.Id, "read", "allergy"); n != 1 {
		t.Errorf("allergy read audit rows = %d, want 1", n)
	}
	if n := c.AuditCount(fam.Id, "read", "lab_result"); n != 0 {
		t.Errorf("a caregiver must not be logged as reading lab results, got %d", n)
	}
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var log httpapi.AccessLogList
	c.Get("/api/members/"+mom.Id.String()+"/access-log", http.StatusOK, &log)
	found := false
	for _, e := range log.Items {
		found = found || (e.Entity == "allergy" && e.Action == "read" && e.ActorName == "Maria")
	}
	if !found {
		t.Errorf("the nanny's read must show in the access log: %+v", log.Items)
	}

	// Without baby_passport: 403.
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{care_log,schedule}' WHERE id = $1`, nanny.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(childPassportPath(nanny.Id, child.Id), http.StatusForbidden, nil)
}

func TestChildPassportNotFoundCases(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("preschool")
	ava := first.Children[0]
	momA := testutil.Parent(t, first, httpapi.ParentRoleMother)
	c.Get(childPassportPath(momA.Id, uuid.New()), http.StatusNotFound, nil)

	second := c.StartDemo("newborn") // the client now holds another family's session
	momB := testutil.Parent(t, second, httpapi.ParentRoleMother)
	c.Get(childPassportPath(momB.Id, ava.Id), http.StatusNotFound, nil) // another family's child
	c.Get(childPassportPath(momA.Id, ava.Id), http.StatusNotFound, nil) // another family's parent
	testutil.New(t).Get(childPassportPath(momB.Id, second.Children[0].Id), http.StatusUnauthorized, nil)

	var p httpapi.ChildPassport
	c.Get(childPassportPath(momB.Id, second.Children[0].Id), http.StatusOK, &p)
	if p.Child.Name != "Leo" || len(p.Allergies) != 1 {
		t.Errorf("newborn passport = %+v", p)
	}
}
