package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func leavePath(id uuid.UUID) string { return "/api/members/" + id.String() + "/leave-plan" }

func answers(state string, employees, months, hours int) map[string]any {
	return map[string]any{"state": state, "employerEmployees": employees, "monthsEmployed": months, "hoursLast12Months": hours}
}

func parentLeave(p httpapi.LeavePlan, id uuid.UUID) httpapi.ParentLeave {
	for _, x := range p.Parents {
		if x.MemberId == id {
			return x
		}
	}
	return httpapi.ParentLeave{}
}

func TestLeavePlanStartsEmptyAndActingParentComesFirst(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Get(leavePath(uuid.New()), http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var p httpapi.LeavePlan
	c.Get(leavePath(jake.Id), http.StatusOK, &p)
	if len(p.Parents) != 2 || p.Parents[0].MemberId != jake.Id || p.Parents[1].MemberId != mom.Id {
		t.Fatalf("the acting parent first: %+v", p.Parents)
	}
	for _, x := range p.Parents {
		if x.Input != nil || len(x.Programs) != 0 || len(x.Segments) != 0 || len(x.Deadlines) != 0 {
			t.Errorf("before the wizard everything is empty: %+v", x)
		}
	}
	c.Get(leavePath(uuid.New()), http.StatusNotFound, nil)
	for _, cg := range fam.Caregivers { // leave is the parents' business
		c.Get(leavePath(cg.Id), http.StatusNotFound, nil)
	}
}

func TestSavingAnswersGivesProgramsTimelineAndDeadlines(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var p httpapi.LeavePlan
	c.Put(leavePath(mom.Id), answers("TX", 200, 36, 2000), http.StatusOK, &p)
	m := parentLeave(p, mom.Id)
	if m.Input == nil || m.Input.State != "TX" || len(m.Programs) != 1 || m.Programs[0].Id != "fmla" || m.Programs[0].Eligibility != httpapi.Eligible {
		t.Fatalf("mom = %+v", m)
	}
	if m.Programs[0].Source.Url == "" || m.Programs[0].Weeks == nil || *m.Programs[0].Weeks != 12 {
		t.Errorf("program = %+v", m.Programs[0])
	}
	// From the due date: 12 weeks, unpaid and job-protected; the notice is due 30 days before.
	due := fam.DueDate.Time
	if len(m.Segments) != 1 || m.Segments[0].Paid || !m.Segments[0].JobProtected || !m.Segments[0].StartsOn.Time.Equal(due) || !m.Segments[0].EndsOn.Time.Equal(due.AddDate(0, 0, 12*7-1)) {
		t.Errorf("segments = %+v", m.Segments)
	}
	if len(m.Deadlines) != 1 || !m.Deadlines[0].DueOn.Time.Equal(due.AddDate(0, 0, -30)) {
		t.Errorf("deadlines = %+v", m.Deadlines)
	}
	// Both parents see both plans; Jake has not answered yet.
	var seen httpapi.LeavePlan
	c.Get(leavePath(jake.Id), http.StatusOK, &seen)
	if parentLeave(seen, mom.Id).Input == nil || parentLeave(seen, jake.Id).Input != nil {
		t.Errorf("Jake sees Mom's answers, not his own: %+v", seen.Parents)
	}
	// His own answers, in a state with its own program, do not change hers.
	var afterJake httpapi.LeavePlan
	c.Put(leavePath(jake.Id), answers("WA", 10, 8, 900), http.StatusOK, &afterJake)
	j := parentLeave(afterJake, jake.Id)
	if len(j.Programs) != 2 || j.Programs[1].Id != "wa_pfml" || j.Programs[1].Eligibility != httpapi.Eligible || j.Programs[0].Eligibility != httpapi.NotEligible {
		t.Errorf("Jake = %+v", j.Programs)
	}
	if len(j.Segments) != 1 || !j.Segments[0].Paid || j.Segments[0].JobProtected {
		t.Errorf("a paid program without FMLA is paid but not job-protected: %+v", j.Segments)
	}
	if got := parentLeave(afterJake, mom.Id); got.Input.State != "TX" {
		t.Errorf("Jake's save changed Mom's answers: %+v", got.Input)
	}

	// Saving again replaces the answers; a start date and weeks wanted move the timeline.
	body := answers("CA", 200, 36, 2000)
	body["startsOn"], body["weeksWanted"] = "2027-03-01", 20
	var resaved httpapi.LeavePlan
	c.Put(leavePath(mom.Id), body, http.StatusOK, &resaved)
	m = parentLeave(resaved, mom.Id)
	if len(m.Programs) != 2 || m.Programs[1].Eligibility != httpapi.Unknown || m.Input.WeeksWanted == nil || *m.Input.WeeksWanted != 20 {
		t.Errorf("California is unknown (earnings are not asked): %+v", m.Programs)
	}
	if m.Segments[0].StartsOn.Format("2006-01-02") != "2027-03-01" || m.Deadlines[0].DueOn.Format("2006-01-02") != "2027-01-30" {
		t.Errorf("the start date moves the timeline: %+v %+v", m.Segments[0], m.Deadlines[0])
	}
}

func TestLeaveTimelineFollowsTheDueDateAndTheBirth(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var p httpapi.LeavePlan
	c.Put(leavePath(mom.Id), answers("TX", 200, 36, 2000), http.StatusOK, &p)
	before := parentLeave(p, mom.Id).Segments[0].StartsOn.Time

	c.Patch("/api/members/"+mom.Id.String()+"/family", map[string]any{"dueDate": fam.DueDate.Time.AddDate(0, 0, 14).Format("2006-01-02")}, http.StatusOK, nil)
	var moved httpapi.LeavePlan
	c.Get(leavePath(mom.Id), http.StatusOK, &moved)
	if got := parentLeave(moved, mom.Id).Segments[0].StartsOn.Time; !got.Equal(before.AddDate(0, 0, 14)) {
		t.Errorf("moving the due date moves the leave: %v -> %v", before, got)
	}
}

func TestLeaveAnswersAreValidated(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	bad := func(mod func(map[string]any)) {
		t.Helper()
		b := answers("TX", 100, 12, 1500)
		mod(b)
		c.Put(leavePath(mom.Id), b, http.StatusBadRequest, nil)
	}
	bad(func(b map[string]any) { b["state"] = "Texas" })
	bad(func(b map[string]any) { b["state"] = "tx" })
	bad(func(b map[string]any) { b["employerEmployees"] = -1 })
	bad(func(b map[string]any) { b["monthsEmployed"] = 601 })
	bad(func(b map[string]any) { b["hoursLast12Months"] = 8785 })
	bad(func(b map[string]any) { b["weeksWanted"] = 0 })
	bad(func(b map[string]any) { b["weeksWanted"] = 53 })
	bad(func(b map[string]any) { b["startsOn"] = "soon" })
	bad(func(b map[string]any) { delete(b, "state") })
}

func TestLeavePlansAreScopedToTheFamily(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	momA := testutil.Parent(t, first, httpapi.ParentRoleMother)
	c.Put(leavePath(momA.Id), answers("NY", 100, 24, 2000), http.StatusOK, nil)
	second := c.StartDemo("pregnancy")
	c.Get(leavePath(momA.Id), http.StatusNotFound, nil)
	var p httpapi.LeavePlan
	c.Get(leavePath(testutil.Parent(t, second, httpapi.ParentRoleMother).Id), http.StatusOK, &p)
	for _, x := range p.Parents {
		if x.Input != nil {
			t.Errorf("another family's answers leaked: %+v", x.Input)
		}
	}
}
