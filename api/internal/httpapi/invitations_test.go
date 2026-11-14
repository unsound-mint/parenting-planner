package httpapi_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func inviteBody(role string, perms ...string) map[string]any {
	return map[string]any{"role": role, "displayName": "Rosa", "permissions": perms}
}

func invitePath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/invitations" }

func TestDemoFamiliesHaveCaregivers(t *testing.T) {
	c := testutil.New(t)
	for _, tpl := range []string{"pregnancy", "planning", "newborn", "preschool"} {
		fam := c.StartDemo(tpl)
		if len(fam.Caregivers) != 2 || len(fam.Parents) != 2 {
			t.Fatalf("%s: want 2 parents and a grandparent and a nanny, got %+v", tpl, fam)
		}
		for _, cg := range fam.Caregivers {
			if len(cg.Permissions) == 0 {
				t.Errorf("%s: %s has no permissions", tpl, cg.Role)
			}
			// A caregiver id is not a parent: parent endpoints answer 404.
			for _, path := range []string{"/plan", "/mood-checkins"} {
				c.Get("/api/members/"+cg.Id.String()+path, http.StatusNotFound, nil)
			}
		}
	}
}

func TestInvitationValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	c.Post(invitePath(mom), inviteBody("partner", "care_log"), http.StatusBadRequest, nil)           // not a caregiver role
	c.Post(invitePath(mom), inviteBody("nanny", "diary"), http.StatusBadRequest, nil)                // a diary can never be granted
	c.Post(invitePath(mom), inviteBody("nanny", "care_log", "care_log"), http.StatusBadRequest, nil) // duplicates
	c.Post(invitePath(mom), map[string]any{"role": "nanny", "permissions": []string{}}, http.StatusBadRequest, nil)
	c.Post(invitePath(mom), map[string]any{"role": "nanny", "displayName": strings.Repeat("x", 61), "permissions": []string{}}, http.StatusBadRequest, nil)
}

func TestInviteAcceptFlow(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var created httpapi.CreatedInvitation
	c.Post(invitePath(mom), inviteBody("nanny", "care_log", "baby_passport"), http.StatusCreated, &created)
	if created.Invitation.Status != httpapi.InvitationStatusPending || created.Path != "/invite/"+created.Token || len(created.Token) < 16 {
		t.Fatalf("created = %+v", created)
	}
	if !created.Invitation.ExpiresAt.Equal(testutil.Now.Add(7 * 24 * time.Hour)) {
		t.Errorf("expires %v, want 7 days from now", created.Invitation.ExpiresAt)
	}
	// Only the hash is stored.
	var n int
	if err := c.Pool.QueryRow(context.Background(), `SELECT count(*) FROM invitations WHERE token_hash = convert_to($1, 'UTF8')`, created.Token).Scan(&n); err != nil || n != 0 {
		t.Errorf("the raw token must not be stored: %d %v", n, err)
	}
	var list httpapi.InvitationList
	c.Get(invitePath(mom), http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].Id != created.Invitation.Id {
		t.Errorf("list = %+v", list.Items)
	}

	// The nanny opens the link in another browser: no session needed to preview.
	nanny := testutil.New(t)
	var prev httpapi.InvitationPreview
	nanny.Get("/api/invitations/"+created.Token, http.StatusOK, &prev)
	if prev.InvitedByName != "Emily" || prev.Status != httpapi.InvitationStatusPending || len(prev.Permissions) != 2 {
		t.Errorf("preview = %+v", prev)
	}
	nanny.Get("/api/invitations/"+strings.Repeat("z", 30), http.StatusNotFound, nil)

	var got httpapi.InvitationAcceptance
	nanny.Post("/api/invitations/"+created.Token+"/accept", nil, http.StatusCreated, &got)
	if got.Family.Id != fam.Id || len(got.Family.Caregivers) != 3 {
		t.Fatalf("acceptance = %+v", got.Family)
	}
	if got.Family.SessionMemberId == nil || *got.Family.SessionMemberId != got.MemberId {
		t.Errorf("the acceptance must say the session is bound to the caregiver: %+v", got.Family.SessionMemberId)
	}
	nanny.Post("/api/invitations/"+created.Token+"/accept", nil, http.StatusConflict, nil) // single use
	nanny.Get("/api/invitations/"+created.Token, http.StatusOK, &prev)
	if prev.Status != httpapi.InvitationStatusAccepted {
		t.Errorf("a used invitation still previews, as accepted: %+v", prev)
	}

	// As the nanny: in the family, but parent-only things are refused.
	me := "/api/members/" + got.MemberId.String()
	var asNanny httpapi.Family
	nanny.Get("/api/family", http.StatusOK, &asNanny)
	if asNanny.SessionMemberId == nil || *asNanny.SessionMemberId != got.MemberId {
		t.Errorf("GET /family must name the session's member: %+v", asNanny.SessionMemberId)
	}
	var asMom httpapi.Family
	c.Get("/api/family", http.StatusOK, &asMom)
	if asMom.SessionMemberId != nil {
		t.Errorf("a demo session is not bound to anyone: %v", *asMom.SessionMemberId)
	}
	nanny.Get(me+"/invitations", http.StatusForbidden, nil)
	nanny.Post(me+"/invitations", inviteBody("nanny", "care_log"), http.StatusForbidden, nil)
	nanny.Get(me+"/access-log", http.StatusForbidden, nil)
	nanny.Get(me+"/plan", http.StatusNotFound, nil)
	nanny.Get(me+"/mood-checkins", http.StatusNotFound, nil)

	c.Get(invitePath(mom), http.StatusOK, &list)
	if list.Items[0].Status != httpapi.InvitationStatusAccepted || list.Items[0].MemberId == nil || *list.Items[0].MemberId != got.MemberId {
		t.Errorf("accepted invitation = %+v", list.Items[0])
	}
}

func TestInvitationExpires(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	var created httpapi.CreatedInvitation
	c.Post(invitePath(mom), inviteBody("grandparent", "schedule"), http.StatusCreated, &created)
	if _, err := c.Pool.Exec(context.Background(), `UPDATE invitations SET expires_at = $2 WHERE id = $1`, created.Invitation.Id, testutil.Now.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	c.Post("/api/invitations/"+created.Token+"/accept", nil, http.StatusConflict, nil)
	var list httpapi.InvitationList
	c.Get(invitePath(mom), http.StatusOK, &list)
	if list.Items[0].Status != httpapi.InvitationStatusExpired {
		t.Errorf("status = %s, want expired", list.Items[0].Status)
	}
	c.Post(invitePath(mom)+"/"+created.Invitation.Id.String()+"/revoke", nil, http.StatusConflict, nil)
}

func TestRevokePendingAndAcceptedInvitations(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var a, b httpapi.CreatedInvitation
	c.Post(invitePath(mom), inviteBody("nanny", "care_log"), http.StatusCreated, &a)
	c.Post(invitePath(mom), inviteBody("grandparent", "schedule"), http.StatusCreated, &b)

	// A pending invitation can be revoked, then no longer accepted.
	var inv httpapi.Invitation
	c.Post(invitePath(mom)+"/"+a.Invitation.Id.String()+"/revoke", nil, http.StatusOK, &inv)
	if inv.Status != httpapi.InvitationStatusRevoked || inv.RevokedAt == nil {
		t.Errorf("revoked = %+v", inv)
	}
	c.Post("/api/invitations/"+a.Token+"/accept", nil, http.StatusConflict, nil)
	c.Post(invitePath(mom)+"/"+a.Invitation.Id.String()+"/revoke", nil, http.StatusConflict, nil)
	c.Post(invitePath(mom)+"/00000000-0000-4000-8000-000000000001/revoke", nil, http.StatusNotFound, nil)

	// Revoking an accepted caregiver removes their access at once.
	grandma := testutil.New(t)
	var got httpapi.InvitationAcceptance
	grandma.Post("/api/invitations/"+b.Token+"/accept", nil, http.StatusCreated, &got)
	cg := "/api/members/" + got.MemberId.String()
	grandma.Get(cg+"/invitations", http.StatusForbidden, nil) // active: a known person, not a parent
	grandma.Get("/api/family", http.StatusOK, nil)
	c.Post(invitePath(mom)+"/"+b.Invitation.Id.String()+"/revoke", nil, http.StatusOK, &inv)
	// The revoked caregiver's session no longer works anywhere, not even for the family.
	grandma.Get(cg+"/invitations", http.StatusUnauthorized, nil)
	grandma.Get("/api/family", http.StatusUnauthorized, nil)
	c.Get(cg+"/invitations", http.StatusNotFound, nil) // and the parent cannot act as them
	var f httpapi.Family
	c.Get("/api/family", http.StatusOK, &f)
	for _, x := range f.Caregivers {
		if x.Id == got.MemberId {
			t.Error("a revoked caregiver must drop out of family.caregivers")
		}
	}
}

func TestOnlyOwnFamilyInvitations(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	momA := testutil.Parent(t, first, httpapi.ParentRoleMother)
	var created httpapi.CreatedInvitation
	c.Post(invitePath(momA), inviteBody("nanny", "care_log"), http.StatusCreated, &created)
	second := c.StartDemo("pregnancy") // the client now holds the second family's session
	c.Get(invitePath(momA), http.StatusNotFound, nil)
	momB := testutil.Parent(t, second, httpapi.ParentRoleMother)
	var list httpapi.InvitationList
	c.Get(invitePath(momB), http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Errorf("another family's invitations leaked: %+v", list.Items)
	}
	c.Post(invitePath(momB)+"/"+created.Invitation.Id.String()+"/revoke", nil, http.StatusNotFound, nil)
}

func TestAccessLogShowsInvitationEventsAndCaregiverActivity(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Get("/api/members/"+mom.Id.String()+"/mood-checkins", http.StatusOK, nil) // a parent's own read: not listed
	var created httpapi.CreatedInvitation
	c.Post(invitePath(mom), inviteBody("nanny", "care_log"), http.StatusCreated, &created)
	var got httpapi.InvitationAcceptance
	testutil.New(t).Post("/api/invitations/"+created.Token+"/accept", nil, http.StatusCreated, &got)
	c.Post(invitePath(mom)+"/"+created.Invitation.Id.String()+"/revoke", nil, http.StatusOK, nil)

	var log httpapi.AccessLogList
	c.Get("/api/members/"+mom.Id.String()+"/access-log", http.StatusOK, &log)
	var actions []string
	for _, e := range log.Items {
		if e.Entity != "invitation" {
			t.Errorf("only invitation events and caregiver activity, got %+v", e)
		}
		actions = append(actions, e.Action)
	}
	if strings.Join(actions, ",") != "revoke,accept,create" { // newest first
		t.Errorf("actions = %v, want revoke, accept, create", actions)
	}
	// The caregiver who accepted is named, but has no id any more after revoke.
	if log.Items[1].ActorName != "Rosa" || log.Items[1].ActorId != nil {
		t.Errorf("accept entry = %+v", log.Items[1])
	}
	if log.Items[2].ActorName != "Emily" || log.Items[2].ActorId == nil {
		t.Errorf("create entry = %+v", log.Items[2])
	}
	if n := c.AuditCount(fam.Id, "accept", "invitation"); n != 1 {
		t.Errorf("accept audit rows = %d", n)
	}
}
