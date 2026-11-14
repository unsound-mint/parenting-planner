package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func tasksPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/tasks" }

func taskList(c *testutil.Client, person uuid.UUID, query string) []httpapi.Task {
	var l httpapi.TaskList
	c.Get(tasksPath(person)+query, http.StatusOK, &l)
	return l.Items
}

func byTitle(items []httpapi.Task, title string) httpapi.Task {
	for _, it := range items {
		if it.Title == title {
			return it
		}
	}
	return httpapi.Task{}
}

func TestTasksListIsOneModelWithKindsAndOrder(t *testing.T) {
	c := testutil.New(t)
	testutil.New(t).Get(tasksPath(uuid.New()), http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	all := taskList(c, mom.Id, "")
	if len(all) != 18 { // 3 paperwork, 8 bag, 3 plan tasks, 4 missions
		t.Fatalf("want 18 items, got %d", len(all))
	}
	if got := taskList(c, jake.Id, ""); len(got) != 18 {
		t.Errorf("both parents see the same list, partner got %d", len(got))
	}
	counts := map[httpapi.TaskKind]int{}
	for _, it := range all {
		counts[it.Kind]++
	}
	if counts[httpapi.TaskKindPaperwork] != 3 || counts[httpapi.TaskKindHospitalBag] != 8 || counts[httpapi.TaskKindTask] != 7 {
		t.Errorf("kinds = %v", counts)
	}
	if n := len(taskList(c, mom.Id, "?kind=hospital_bag")); n != 8 {
		t.Errorf("kind filter returned %d bag items", n)
	}
	c.Get(tasksPath(mom.Id)+"?kind=nope", http.StatusBadRequest, nil)

	// Soonest due first, undated (the bag) last.
	seenUndated := false
	var last time.Time
	for _, it := range all {
		switch {
		case it.DueOn == nil:
			seenUndated = true
		case seenUndated:
			t.Fatalf("dated task %q after an undated one", it.Title)
		case it.DueOn.Time.Before(last):
			t.Errorf("%q is out of order", it.Title)
		default:
			last = it.DueOn.Time
		}
	}
	// Every item has one owner, and the paperwork cites a source.
	for _, it := range all {
		if it.AssigneeId != mom.Id && it.AssigneeId != jake.Id {
			t.Errorf("%q has no parent owner", it.Title)
		}
		if it.Kind == httpapi.TaskKindPaperwork && (it.Source == nil || it.Source.Url == "" || it.DueAnchor == nil) {
			t.Errorf("paperwork %q needs a source and an anchor: %+v", it.Title, it)
		}
	}
	// The seeded offer is visible: the car seat is offered to Jake.
	if seat := byTitle(all, "Install the car seat"); seat.PendingAssigneeId == nil || *seat.PendingAssigneeId != jake.Id || seat.AssigneeId != mom.Id {
		t.Errorf("car seat = %+v", seat)
	}
}

func TestMovingTheDueDateMovesPaperworkDeadlines(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	before := taskList(c, mom.Id, "?kind=paperwork")
	notice := byTitle(before, "Tell your employer you will take parental leave")
	if notice.DueOn == nil || notice.DueOffsetDays == nil || *notice.DueOffsetDays != -30 || *notice.DueAnchor != httpapi.DueDate {
		t.Fatalf("leave notice = %+v", notice)
	}
	if want := fam.DueDate.Time.AddDate(0, 0, -30); !notice.DueOn.Time.Equal(want) {
		t.Errorf("leave notice due %v, want %v", notice.DueOn.Time, want)
	}
	insurance := byTitle(before, "Add the baby to your health insurance")
	if insurance.DueOffsetDays != nil || insurance.DueOn == nil {
		t.Errorf("before the birth a birth-date deadline is an estimate from the due date, without an offset: %+v", insurance)
	}

	c.Patch("/api/members/"+mom.Id.String()+"/family", map[string]any{"dueDate": fam.DueDate.Time.AddDate(0, 0, 14).Format("2006-01-02")}, http.StatusOK, nil)
	for _, it := range taskList(c, mom.Id, "?kind=paperwork") {
		old := byTitle(before, it.Title)
		if d := it.DueOn.Time.Sub(old.DueOn.Time); d != 14*24*time.Hour {
			t.Errorf("%q moved by %v, want 14 days", it.Title, d)
		}
	}
}

func TestBabyIsHomeHidesTheBagAndAnchorsOnTheBirth(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	born := testutil.Now.AddDate(0, 0, -2)
	c.Post(arrivalPath(mom), map[string]any{"name": "Ava", "birthDate": born.Format("2006-01-02")}, http.StatusCreated, nil)
	if n := len(taskList(c, mom.Id, "?kind=hospital_bag")); n != 0 {
		t.Errorf("hospital bag items must not be returned after Baby is home, got %d", n)
	}
	insurance := byTitle(taskList(c, mom.Id, "?kind=paperwork"), "Add the baby to your health insurance")
	if insurance.DueOffsetDays == nil || *insurance.DueOffsetDays != 60 || !insurance.DueOn.Time.Equal(born.Truncate(24*time.Hour).AddDate(0, 0, 60)) {
		t.Errorf("after the birth the deadline counts from the birth date: %+v", insurance)
	}
}

func TestCreateTask(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleNanny {
			nanny = cg
		}
	}
	var made httpapi.Task
	c.Post(tasksPath(jake.Id), map[string]any{"title": "Call the insurer", "dueOn": "2026-12-01", "detail": "Ask about the pump"}, http.StatusCreated, &made)
	if made.Kind != httpapi.TaskKindTask || made.AssigneeId != jake.Id || made.Done || made.DueOn == nil || made.DueOn.Format("2006-01-02") != "2026-12-01" {
		t.Errorf("task = %+v", made)
	}
	var bag httpapi.Task
	c.Post(tasksPath(mom.Id), map[string]any{"title": "Pack lip balm", "kind": "hospital_bag", "bag": "mother"}, http.StatusCreated, &bag)
	if bag.Kind != httpapi.TaskKindHospitalBag || bag.Bag == nil || *bag.Bag != httpapi.HospitalBagMother {
		t.Errorf("bag item = %+v", bag)
	}
	c.Post(tasksPath(mom.Id), map[string]any{"title": "x", "kind": "hospital_bag"}, http.StatusBadRequest, nil)        // no bag
	c.Post(tasksPath(mom.Id), map[string]any{"title": "x", "kind": "task", "bag": "baby"}, http.StatusBadRequest, nil) // bag on a plain task
	c.Post(tasksPath(mom.Id), map[string]any{"title": "x", "kind": "paperwork"}, http.StatusBadRequest, nil)           // paperwork is seeded
	c.Post(tasksPath(mom.Id), map[string]any{"title": ""}, http.StatusBadRequest, nil)
	c.Post(tasksPath(mom.Id), map[string]any{"title": "x", "dueOn": "soon"}, http.StatusBadRequest, nil)

	// A caregiver needs family_plan to see, add or be offered tasks.
	c.Get(tasksPath(nanny.Id), http.StatusForbidden, nil)
	c.Post(tasksPath(nanny.Id), map[string]any{"title": "Restock diapers"}, http.StatusForbidden, nil)
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{family_plan}' WHERE id = $1`, nanny.Id); err != nil {
		t.Fatal(err)
	}
	var theirs httpapi.Task
	c.Post(tasksPath(nanny.Id), map[string]any{"title": "Restock diapers"}, http.StatusCreated, &theirs)
	if theirs.AssigneeId != nanny.Id || len(taskList(c, nanny.Id, "")) < 15 {
		t.Errorf("a caregiver with family_plan owns what they add and sees the list: %+v", theirs)
	}
}

func TestTickingATask(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleNanny {
			nanny = cg
		}
	}
	class := byTitle(taskList(c, mom.Id, ""), "Book the birth class") // Jake's
	path := tasksPath(mom.Id) + "/" + class.Id.String()

	var got httpapi.Task
	c.Patch(path, map[string]any{"done": true}, http.StatusOK, &got) // either parent may tick
	if !got.Done || got.DoneAt == nil || got.DoneById == nil || *got.DoneById != mom.Id || got.AssigneeId != jake.Id {
		t.Errorf("ticked = %+v", got)
	}
	got = httpapi.Task{}
	c.Patch(tasksPath(jake.Id)+"/"+class.Id.String(), map[string]any{"done": false}, http.StatusOK, &got)
	if got.Done || got.DoneAt != nil || got.DoneById != nil {
		t.Errorf("unticked = %+v", got)
	}
	// Someone who is neither the assignee nor a parent: 403. Unknown task: 404. Bad body: 400.
	c.Patch(tasksPath(nanny.Id)+"/"+class.Id.String(), map[string]any{"done": true}, http.StatusForbidden, nil)
	c.Patch(tasksPath(mom.Id)+"/"+uuid.NewString(), map[string]any{"done": true}, http.StatusNotFound, nil)
	c.Patch(path, map[string]any{}, http.StatusBadRequest, nil)
}

func TestReassignmentMovesOwnershipOnlyOnAccept(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleNanny {
			nanny = cg
		}
	}
	items := taskList(c, mom.Id, "")
	pick := byTitle(items, "Pick a pediatrician") // Mom's, not offered
	base := func(p httpapi.Parent) string { return tasksPath(p.Id) + "/" + pick.Id.String() + "/reassignment" }

	// Only the assignee can offer, and not to themselves or to strangers.
	c.Post(base(jake), map[string]any{"toMemberId": mom.Id}, http.StatusConflict, nil)
	c.Post(base(mom), map[string]any{"toMemberId": mom.Id}, http.StatusConflict, nil)
	c.Post(base(mom), map[string]any{"toMemberId": uuid.New()}, http.StatusBadRequest, nil)
	c.Post(base(mom), map[string]any{"toMemberId": nanny.Id}, http.StatusBadRequest, nil) // a caregiver without family_plan

	var offered httpapi.Task
	c.Post(base(mom), map[string]any{"toMemberId": jake.Id}, http.StatusOK, &offered)
	if offered.AssigneeId != mom.Id || offered.PendingAssigneeId == nil || *offered.PendingAssigneeId != jake.Id {
		t.Fatalf("the task keeps its assignee until accepted: %+v", offered)
	}
	// Only the person it was offered to answers.
	c.Post(base(mom)+"/accept", nil, http.StatusConflict, nil)
	c.Post(base(mom)+"/decline", nil, http.StatusConflict, nil)
	var taken httpapi.Task
	c.Post(base(jake)+"/accept", nil, http.StatusOK, &taken)
	if taken.AssigneeId != jake.Id || taken.PendingAssigneeId != nil {
		t.Errorf("accepted = %+v", taken)
	}
	c.Post(base(jake)+"/accept", nil, http.StatusConflict, nil) // nothing is offered any more

	// Decline: Jake offers it back, Mom declines, it stays with Jake.
	c.Post(base(jake), map[string]any{"toMemberId": mom.Id}, http.StatusOK, nil)
	var declined httpapi.Task
	c.Post(base(mom)+"/decline", nil, http.StatusOK, &declined)
	if declined.AssigneeId != jake.Id || declined.PendingAssigneeId != nil {
		t.Errorf("declined = %+v", declined)
	}

	// A caregiver with family_plan can be offered a task and accept it.
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{family_plan}' WHERE id = $1`, nanny.Id); err != nil {
		t.Fatal(err)
	}
	c.Post(base(jake), map[string]any{"toMemberId": nanny.Id}, http.StatusOK, nil)
	var theirs httpapi.Task
	c.Post(tasksPath(nanny.Id)+"/"+pick.Id.String()+"/reassignment/accept", nil, http.StatusOK, &theirs)
	if theirs.AssigneeId != nanny.Id {
		t.Errorf("the caregiver accepted: %+v", theirs)
	}
	c.Post(base(mom)+"/accept", nil, http.StatusConflict, nil)
	c.Post(tasksPath(mom.Id)+"/"+uuid.NewString()+"/reassignment/accept", nil, http.StatusNotFound, nil)
}

func TestTasksAreScopedToTheFamilyAndPublishLiveUpdates(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	momA := testutil.Parent(t, first, httpapi.ParentRoleMother)
	jakeA := testutil.Parent(t, first, httpapi.ParentRolePartner)
	seat := byTitle(taskList(c, momA.Id, ""), "Install the car seat")
	live := openLive(t, c, jakeA.Id)
	c.Patch(tasksPath(momA.Id)+"/"+seat.Id.String(), map[string]any{"done": true}, http.StatusOK, nil)
	if u := next(t, live, 5*time.Second); u.Kind != "task" || u.EntityID != seat.Id.String() || u.ActorID != momA.Id {
		t.Errorf("update = %+v, want a task update by the mother", u)
	}

	second := c.StartDemo("pregnancy") // the client now holds another family's session
	momB := testutil.Parent(t, second, httpapi.ParentRoleMother)
	c.Patch(tasksPath(momB.Id)+"/"+seat.Id.String(), map[string]any{"done": false}, http.StatusNotFound, nil)
	c.Post(tasksPath(momB.Id)+"/"+seat.Id.String()+"/reassignment", map[string]any{"toMemberId": momB.Id}, http.StatusNotFound, nil)
	for _, it := range taskList(c, momB.Id, "") {
		if it.Id == seat.Id {
			t.Error("another family's task leaked")
		}
	}
	c.Get(tasksPath(momA.Id), http.StatusNotFound, nil)
}
