package httpapi_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func invite(role string, perms ...string) map[string]any {
	return map[string]any{"role": role, "displayName": "Rosa", "permissions": perms}
}

func TestInvitationValidation(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	path := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String() + "/invitations"
	c.Post(path, invite("nanny"), http.StatusBadRequest, nil)                       // no permissions
	c.Post(path, invite("partner", "feeding"), http.StatusBadRequest, nil)          // not a caregiver role
	c.Post(path, invite("nanny", "diary"), http.StatusBadRequest, nil)              // journal can never be granted
	c.Post(path, invite("nanny", "feeding", "feeding"), http.StatusBadRequest, nil) // duplicates
	c.Post("/api/invitations/accept", map[string]any{}, http.StatusBadRequest, nil)
}

func TestOnlyParentsInviteAndFamiliesAreSeparate(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	// A caregiver id is not a parent, so it cannot invite or list.
	c.Post("/api/members/"+fam.Caregivers[0].Id.String()+"/invitations", invite("nanny", "feeding"), http.StatusNotFound, nil)
	var inv httpapi.Invitation
	c.Post("/api/members/"+mom.Id.String()+"/invitations", invite("nanny", "feeding"), http.StatusCreated, &inv)
	other := c.StartDemo("pregnancy") // the client now holds another family's session
	_ = other
	c.Delete("/api/members/"+testutil.Parent(t, other, httpapi.ParentRoleMother).Id.String()+"/invitations/"+inv.Id.String(), http.StatusNotFound, nil)
	var list httpapi.InvitationList
	c.Get("/api/members/"+testutil.Parent(t, other, httpapi.ParentRoleMother).Id.String()+"/invitations", http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Errorf("another family must not see the invitation: %+v", list.Items)
	}
	c.Get("/api/members/"+mom.Id.String()+"/invitations", http.StatusNotFound, nil) // wrong family for this session
}

func TestInviteAcceptGivesLimitedCaregiver(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var inv httpapi.Invitation
	c.Post("/api/members/"+mom.Id.String()+"/invitations", invite("nanny", "feeding", "sleep", "allergies"), http.StatusCreated, &inv)
	if inv.Token == nil || *inv.Token == "" || inv.Status != httpapi.Pending {
		t.Fatalf("want a pending invitation with a token, got %+v", inv)
	}
	if !inv.ExpiresAt.Equal(testutil.Now.Add(7 * 24 * time.Hour)) {
		t.Errorf("expires %v, want 7 days from now", inv.ExpiresAt)
	}
	var list httpapi.InvitationList
	c.Get("/api/members/"+mom.Id.String()+"/invitations", http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].Token != nil {
		t.Errorf("list must show the invitation without its token: %+v", list.Items)
	}

	// The nanny opens the link in a fresh browser: no session yet.
	nanny := testutil.New(t)
	nanny.Get("/api/family", http.StatusUnauthorized, nil)
	var cg httpapi.Caregiver
	nanny.Post("/api/invitations/accept", map[string]string{"token": *inv.Token}, http.StatusCreated, &cg)
	if cg.Role != httpapi.Nanny || cg.Permissions == nil || len(*cg.Permissions) != 3 {
		t.Fatalf("caregiver = %+v", cg)
	}
	// The token works once.
	nanny.Post("/api/invitations/accept", map[string]string{"token": *inv.Token}, http.StatusGone, nil)
	nanny.Post("/api/invitations/accept", map[string]string{"token": "nope"}, http.StatusNotFound, nil)

	// Now in the family, the nanny is listed, but cannot act as a parent: no plan, mood or invitations.
	var f httpapi.Family
	nanny.Get("/api/family", http.StatusOK, &f)
	found := false
	for _, x := range f.Caregivers {
		found = found || x.Id == cg.Id
	}
	if !found {
		t.Error("accepted caregiver missing from the family")
	}
	for _, path := range []string{"/plan", "/mood-checkins", "/invitations"} {
		nanny.Get("/api/members/"+cg.Id.String()+path, http.StatusNotFound, nil)
	}
}

func TestInvitationExpiresAndCanBeRevoked(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	base := "/api/members/" + mom.Id.String() + "/invitations"

	var expired, revoked httpapi.Invitation
	c.Post(base, invite("grandparent", "schedule"), http.StatusCreated, &expired)
	c.Post(base, invite("nanny", "feeding"), http.StatusCreated, &revoked)

	if _, err := c.Pool.Exec(context.Background(), `UPDATE invitations SET expires_at = $2 WHERE id = $1`, expired.Id, testutil.Now.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	c.Post("/api/invitations/accept", map[string]string{"token": *expired.Token}, http.StatusGone, nil)

	c.Delete(base+"/"+revoked.Id.String(), http.StatusNoContent, nil)
	c.Post("/api/invitations/accept", map[string]string{"token": *revoked.Token}, http.StatusGone, nil)
	c.Delete(base+"/"+revoked.Id.String(), http.StatusNotFound, nil) // already revoked

	var list httpapi.InvitationList
	c.Get(base, http.StatusOK, &list)
	got := map[string]httpapi.InvitationStatus{}
	for _, i := range list.Items {
		got[i.Id.String()] = i.Status
	}
	if got[expired.Id.String()] != httpapi.Expired || got[revoked.Id.String()] != httpapi.Revoked {
		t.Errorf("statuses = %v", got)
	}
}

func TestInvitationsAreAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	base := "/api/members/" + mom.Id.String() + "/invitations"
	var a, b httpapi.Invitation
	c.Post(base, invite("nanny", "feeding"), http.StatusCreated, &a)
	c.Post(base, invite("grandparent", "visits"), http.StatusCreated, &b)
	c.Get(base, http.StatusOK, nil)
	c.Post("/api/invitations/accept", map[string]string{"token": *a.Token}, http.StatusCreated, nil)
	c.Delete(base+"/"+b.Id.String(), http.StatusNoContent, nil)
	for action, want := range map[string]int{"create": 2, "read": 1, "update": 1, "delete": 1} {
		if n := c.AuditCount(fam.Id, action, "invitation"); n != want {
			t.Errorf("%s audit rows = %d, want %d", action, n, want)
		}
	}
}
