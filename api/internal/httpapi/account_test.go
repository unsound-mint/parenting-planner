package httpapi_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestExportNeedsSessionAndOwnFamily(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/members/"+uuid.NewString()+"/export", http.StatusUnauthorized, nil)
	c.StartDemo("pregnancy")
	c.Get("/api/members/"+uuid.NewString()+"/export", http.StatusNotFound, nil)
}

func TestExportHoldsOwnPrivateRecordsButNotThePartners(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	momBase := "/api/members/" + mom.Id.String()
	partnerBase := "/api/members/" + partner.Id.String()

	note := func(s string) httpapi.MoodCheckinInput {
		in := checkin(3, httpapi.VisibilityPrivate)
		in.Note = &s
		return in
	}
	shared := checkin(4, httpapi.VisibilityPartner)
	sharedNote := "partner shared this"
	shared.Note = &sharedNote
	c.Post(momBase+"/mood-checkins", note("mother private"), http.StatusCreated, nil)
	c.Post(partnerBase+"/mood-checkins", note("partner private"), http.StatusCreated, nil)
	c.Post(partnerBase+"/mood-checkins", shared, http.StatusCreated, nil)
	rule := getPlan(c, mom).Items[0].RuleId
	c.Put(statusPath(mom, rule), httpapi.PlanItemProgressInput{Status: httpapi.PlanItemProgressBooked}, http.StatusOK, nil)

	var e httpapi.MemberExport
	c.Get(momBase+"/export", http.StatusOK, &e)
	if cd := c.LastHeader.Get("Content-Disposition"); !strings.HasPrefix(cd, "attachment;") {
		t.Errorf("Content-Disposition = %q, want an attachment", cd)
	}
	if e.MemberId != mom.Id || e.Family.Id != fam.Id {
		t.Errorf("export is for member %s family %s", e.MemberId, e.Family.Id)
	}

	notes := map[string]bool{}
	for _, m := range e.MoodCheckins {
		if m.Note != nil {
			notes[*m.Note] = true
		}
	}
	if !notes["mother private"] || !notes["partner shared this"] {
		t.Errorf("export misses the mother's own or the shared check-in: %v", notes)
	}
	if notes["partner private"] {
		t.Error("export holds the partner's private check-in")
	}

	labs := map[string]bool{}
	for _, p := range e.Passport.People {
		for _, l := range p.Labs {
			labs[l.Name] = true
		}
	}
	// From the seed: TSH is the mother's private lab, total cholesterol the
	// partner's shared one and fasting glucose the partner's private one.
	if !labs["TSH"] || !labs["Total cholesterol"] {
		t.Errorf("export misses own private or shared labs: %v", labs)
	}
	if labs["Fasting glucose"] {
		t.Error("export holds the partner's private lab")
	}

	if len(e.PlanProgress) != 1 || e.PlanProgress[0].RuleId != rule {
		t.Errorf("plan progress = %+v", e.PlanProgress)
	}

	// The partner's export is the mirror image.
	var pe httpapi.MemberExport
	c.Get(partnerBase+"/export", http.StatusOK, &pe)
	for _, m := range pe.MoodCheckins {
		if m.Note != nil && *m.Note == "mother private" {
			t.Error("partner's export holds the mother's private check-in")
		}
	}
	if len(pe.PlanProgress) != 0 {
		t.Errorf("partner's export holds the mother's plan progress: %+v", pe.PlanProgress)
	}
}

func TestExportIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)

	c.Get("/api/members/"+mom.Id.String()+"/export", http.StatusOK, nil)
	for _, entity := range []string{"member_export", "mood_checkin", "lab_result", "allergy", "psychologist_booking", "session_note"} {
		if n := c.AuditCount(fam.Id, "read", entity); n != 1 {
			t.Errorf("read audit rows for %s = %d, want 1", entity, n)
		}
	}
}

// familyRows counts rows for the family in every table that has a family_id.
func familyRows(t *testing.T, c *testutil.Client, familyID uuid.UUID) map[string]int {
	t.Helper()
	ctx := context.Background()
	rows, err := c.Pool.Query(ctx, `SELECT table_name FROM information_schema.columns
		WHERE table_schema = 'public' AND column_name = 'family_id'`)
	if err != nil {
		t.Fatal(err)
	}
	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		tables = append(tables, name)
	}
	rows.Close()
	out := map[string]int{}
	for _, table := range tables {
		var n int
		if err := c.Pool.QueryRow(ctx, `SELECT count(*) FROM "`+table+`" WHERE family_id = $1`, familyID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		out[table] = n
	}
	var n int
	if err := c.Pool.QueryRow(ctx, `SELECT count(*) FROM families WHERE id = $1`, familyID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	out["families"] = n
	return out
}

func TestDeleteFamilyRemovesOnlyThatFamily(t *testing.T) {
	c := testutil.New(t)
	c.Delete("/api/family", http.StatusUnauthorized, nil)

	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Post("/api/members/"+mom.Id.String()+"/mood-checkins", checkin(3, httpapi.VisibilityPrivate), http.StatusCreated, nil)
	c.Get("/api/members/"+mom.Id.String()+"/export", http.StatusOK, nil) // leaves audit rows

	other := testutil.New(t)
	otherFam := other.StartDemo("pregnancy")
	otherBefore := familyRows(t, other, otherFam.Id)

	oldCookie := c.SessionCookie()
	if oldCookie == "" {
		t.Fatal("no session cookie before delete")
	}
	if before := familyRows(t, c, fam.Id); before["members"] == 0 || before["mood_checkins"] == 0 || before["audit_log"] == 0 {
		t.Fatalf("seed rows missing before delete: %v", before)
	}

	c.Delete("/api/family", http.StatusNoContent, nil)
	if !strings.Contains(c.LastHeader.Get("Set-Cookie"), "pp_session=;") {
		t.Errorf("Set-Cookie = %q, want the session cookie cleared", c.LastHeader.Get("Set-Cookie"))
	}
	if c.SessionCookie() != "" {
		t.Error("client still holds the session cookie")
	}
	for table, n := range familyRows(t, c, fam.Id) {
		if n != 0 {
			t.Errorf("%s still has %d rows of the deleted family", table, n)
		}
	}
	otherAfter := familyRows(t, other, otherFam.Id)
	for table, n := range otherBefore {
		if otherAfter[table] != n {
			t.Errorf("other family's %s changed from %d to %d rows", table, n, otherAfter[table])
		}
	}
	other.Get("/api/family", http.StatusOK, nil)

	c.SetSessionCookie(oldCookie)
	c.Get("/api/family", http.StatusUnauthorized, nil)
	c.Get("/api/members/"+mom.Id.String()+"/export", http.StatusUnauthorized, nil)
}
