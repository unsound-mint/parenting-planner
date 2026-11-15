package httpapi_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func childPassportPath(member, child uuid.UUID) string {
	return "/api/members/" + member.String() + "/children/" + child.String() + "/passport"
}

func TestChildPassportParentSeesAllCaregiverSeesLimited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	gran := caregiver(t, fam, httpapi.CaregiverRoleGrandparent)
	child := fam.Children[0].Id

	var full httpapi.ChildPassport
	c.Get(childPassportPath(mom.Id, child), http.StatusOK, &full)
	if full.Child.Id != child || full.LimitedView || full.Vaccines == nil || full.MedicalHistory == nil || full.Pediatrician == nil {
		t.Fatalf("parent view: %+v", full)
	}
	if len(*full.Vaccines) == 0 {
		t.Fatal("the newborn has scheduled doses")
	}

	var limited httpapi.ChildPassport
	c.Get(childPassportPath(gran.Id, child), http.StatusOK, &limited)
	if !limited.LimitedView || limited.Vaccines != nil || limited.MedicalHistory != nil || limited.Child.Id != child {
		t.Fatalf("caregiver view: %+v", limited)
	}

	if _, err := c.Pool.Exec(context.Background(), `UPDATE members SET permissions = ARRAY['care_log'] WHERE id = $1`, gran.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(childPassportPath(gran.Id, child), http.StatusForbidden, nil)
	c.Get(childPassportPath(mom.Id, uuid.New()), http.StatusNotFound, nil)
}
