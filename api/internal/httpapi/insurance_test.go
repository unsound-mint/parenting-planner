package httpapi_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func callsPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/insurance-calls" }

func callBody(vis string) map[string]any {
	return map[string]any{
		"calledAt": testutil.Now.Add(-time.Hour).Format(time.RFC3339), "insurer": "Lakeside Health Plan", "topic": "claim",
		"summary": "Asked about a claim", "visibility": vis,
	}
}

func callSummaries(c *testutil.Client, id uuid.UUID) []string {
	var l httpapi.InsuranceCallList
	c.Get(callsPath(id), http.StatusOK, &l)
	out := []string{}
	for _, it := range l.Items {
		out = append(out, it.Summary)
	}
	return out
}

func TestInsuranceCallValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	bad := func(mod func(map[string]any)) {
		t.Helper()
		b := callBody("private")
		mod(b)
		c.Post(callsPath(mom.Id), b, http.StatusBadRequest, nil)
	}
	bad(func(b map[string]any) { delete(b, "visibility") })
	bad(func(b map[string]any) { b["visibility"] = "everyone" })
	bad(func(b map[string]any) { b["topic"] = "gossip" })
	bad(func(b map[string]any) { b["insurer"] = "" })
	bad(func(b map[string]any) { b["summary"] = "" })
	bad(func(b map[string]any) { b["summary"] = strings.Repeat("a", 2001) })
	bad(func(b map[string]any) { b["calledAt"] = "yesterday" })
	bad(func(b map[string]any) { b["followUpOn"] = "next week" })
	bad(func(b map[string]any) { b["referenceNumber"] = strings.Repeat("1", 41) })
	testutil.New(t).Post(callsPath(mom.Id), callBody("private"), http.StatusUnauthorized, nil)
}

func TestInsuranceCallsFollowTheSharingRules(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var made httpapi.InsuranceCall
	b := callBody("private")
	b["referenceNumber"], b["representative"], b["followUpOn"] = "CL-1", "Sam", "2026-12-01"
	c.Post(callsPath(jake.Id), b, http.StatusCreated, &made)
	if made.AuthorId != jake.Id || made.Visibility != httpapi.VisibilityPrivate || made.FollowUpOn == nil || made.ReferenceNumber == nil || *made.ReferenceNumber != "CL-1" {
		t.Errorf("created = %+v", made)
	}
	// Seeded: Mom shared one with the family, kept one private; Jake shared one with his partner.
	moms := callSummaries(c, mom.Id)
	jakes := callSummaries(c, jake.Id)
	has := func(list []string, part string) bool {
		for _, s := range list {
			if strings.Contains(s, part) {
				return true
			}
		}
		return false
	}
	if !has(moms, "status of a lab claim") || !has(moms, "breast pump") || has(moms, "Asked about a claim") {
		t.Errorf("Mom sees her own and Jake's shared, not his private: %v", moms)
	}
	if has(jakes, "status of a lab claim") || !has(jakes, "Asked about the status") && !has(jakes, "add the baby") || !has(jakes, "Asked about a claim") {
		t.Errorf("Jake must not see Mom's private call: %v", jakes)
	}
	// Newest first.
	var l httpapi.InsuranceCallList
	c.Get(callsPath(mom.Id), http.StatusOK, &l)
	for i := 1; i < len(l.Items); i++ {
		if l.Items[i].CalledAt.After(l.Items[i-1].CalledAt) {
			t.Errorf("not newest first at %d", i)
		}
	}
	// Only the last 365 days.
	old := callBody("family")
	old["calledAt"] = testutil.Now.AddDate(-1, 0, -2).Format(time.RFC3339)
	old["summary"] = "Long ago"
	c.Post(callsPath(mom.Id), old, http.StatusCreated, nil)
	if has(callSummaries(c, mom.Id), "Long ago") {
		t.Error("calls older than 365 days must not be listed")
	}
}

func TestInsuranceCallsAreAuditedAndScoped(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	momA := testutil.Parent(t, first, httpapi.ParentRoleMother)
	c.Post(callsPath(momA.Id), callBody("family"), http.StatusCreated, nil)
	callSummaries(c, momA.Id)
	if n := c.AuditCount(first.Id, "create", "insurance_call"); n != 1 {
		t.Errorf("create audit rows = %d", n)
	}
	if n := c.AuditCount(first.Id, "read", "insurance_call"); n != 1 {
		t.Errorf("read audit rows = %d", n)
	}
	for _, cg := range first.Caregivers {
		c.Get(callsPath(cg.Id), http.StatusNotFound, nil)
		c.Post(callsPath(cg.Id), callBody("family"), http.StatusNotFound, nil)
	}
	second := c.StartDemo("pregnancy") // the client now holds another family's session
	c.Get(callsPath(momA.Id), http.StatusNotFound, nil)
	for _, s := range callSummaries(c, testutil.Parent(t, second, httpapi.ParentRoleMother).Id) {
		if s == "Asked about a claim" {
			t.Error("another family's call leaked")
		}
	}
}
