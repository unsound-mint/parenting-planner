package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

type taskFixture struct {
	c            *testutil.Client
	mom, partner httpapi.Parent
}

func newTaskFixture(t *testing.T) taskFixture {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	return taskFixture{c, testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)}
}

func tasksPath(p httpapi.Parent) string { return "/api/members/" + p.Id.String() + "/tasks" }

func (f taskFixture) get(t *testing.T, id uuid.UUID) httpapi.Task {
	t.Helper()
	var l httpapi.TaskList
	f.c.Get(tasksPath(f.mom), http.StatusOK, &l)
	for _, it := range l.Items {
		if it.Id == id {
			return it
		}
	}
	t.Fatalf("task %s not in the list", id)
	return httpapi.Task{}
}

func TestTaskValidation(t *testing.T) {
	f := newTaskFixture(t)
	f.c.Post(tasksPath(f.mom), map[string]any{"title": ""}, http.StatusBadRequest, nil)
	f.c.Post(tasksPath(f.mom), map[string]any{"title": "x", "dueOn": "not a date"}, http.StatusBadRequest, nil)

	var task httpapi.Task
	f.c.Post(tasksPath(f.mom), httpapi.TaskInput{Title: "Pack the hospital bag"}, http.StatusCreated, &task)
	if task.AssigneeId != f.mom.Id || task.PendingAssigneeId != nil {
		t.Fatalf("a new task belongs to its creator with no offer, got %+v", task)
	}
	f.c.Post(tasksPath(f.mom)+"/"+task.Id.String()+"/reassignment", map[string]any{}, http.StatusBadRequest, nil)
}

func TestBothParentsSeeTheSameTasks(t *testing.T) {
	f := newTaskFixture(t)
	var mine, theirs httpapi.TaskList
	f.c.Get(tasksPath(f.mom), http.StatusOK, &mine)
	f.c.Get(tasksPath(f.partner), http.StatusOK, &theirs)
	if len(mine.Items) != 3 || len(theirs.Items) != 3 {
		t.Fatalf("seeded family has 3 tasks; mom sees %d, partner sees %d", len(mine.Items), len(theirs.Items))
	}
	var offered int
	for _, it := range mine.Items {
		if it.PendingAssigneeId != nil {
			offered++
			if *it.PendingAssigneeId != f.partner.Id || it.AssigneeId != f.mom.Id {
				t.Errorf("seeded offer must be from mom to partner, got %+v", it)
			}
		}
	}
	if offered != 1 {
		t.Errorf("seeded family has 1 open offer, got %d", offered)
	}
}

// Done when (#90): a reassigned task stays with the old owner until accepted.
func TestReassignedTaskStaysUntilAccepted(t *testing.T) {
	f := newTaskFixture(t)
	var task httpapi.Task
	f.c.Post(tasksPath(f.mom), httpapi.TaskInput{Title: "Call the insurer"}, http.StatusCreated, &task)
	base := tasksPath(f.mom) + "/" + task.Id.String() + "/reassignment"

	var offered httpapi.Task
	f.c.Post(base, httpapi.TaskReassignmentInput{ToMemberId: f.partner.Id}, http.StatusOK, &offered)
	if offered.AssigneeId != f.mom.Id || offered.PendingAssigneeId == nil || *offered.PendingAssigneeId != f.partner.Id {
		t.Fatalf("after the offer the task must stay with mom and be pending for the partner, got %+v", offered)
	}
	if got := f.get(t, task.Id); got.AssigneeId != f.mom.Id {
		t.Fatalf("listed task moved before acceptance: %+v", got)
	}

	// Mom cannot accept on the partner's behalf.
	f.c.Post(base+"/accept", nil, http.StatusConflict, nil)
	if got := f.get(t, task.Id); got.AssigneeId != f.mom.Id {
		t.Fatalf("task moved after a refused accept: %+v", got)
	}

	var accepted httpapi.Task
	f.c.Post(tasksPath(f.partner)+"/"+task.Id.String()+"/reassignment/accept", nil, http.StatusOK, &accepted)
	if accepted.AssigneeId != f.partner.Id || accepted.PendingAssigneeId != nil {
		t.Fatalf("after accept the partner must own the task with no offer left, got %+v", accepted)
	}
	if got := f.get(t, task.Id); got.AssigneeId != f.partner.Id {
		t.Fatalf("listed task did not move after acceptance: %+v", got)
	}
	// Accepting twice is not possible: the offer is gone.
	f.c.Post(tasksPath(f.partner)+"/"+task.Id.String()+"/reassignment/accept", nil, http.StatusConflict, nil)
}

func TestDeclinedTaskStaysWithItsOwner(t *testing.T) {
	f := newTaskFixture(t)
	var task httpapi.Task
	f.c.Post(tasksPath(f.mom), httpapi.TaskInput{Title: "Order the crib"}, http.StatusCreated, &task)
	f.c.Post(tasksPath(f.mom)+"/"+task.Id.String()+"/reassignment", httpapi.TaskReassignmentInput{ToMemberId: f.partner.Id}, http.StatusOK, nil)

	f.c.Post(tasksPath(f.mom)+"/"+task.Id.String()+"/reassignment/decline", nil, http.StatusConflict, nil)
	var declined httpapi.Task
	f.c.Post(tasksPath(f.partner)+"/"+task.Id.String()+"/reassignment/decline", nil, http.StatusOK, &declined)
	if declined.AssigneeId != f.mom.Id || declined.PendingAssigneeId != nil {
		t.Fatalf("after decline the task stays with mom and the offer is gone, got %+v", declined)
	}
}

func TestOnlyTheAssigneeCanOfferATask(t *testing.T) {
	f := newTaskFixture(t)
	var task httpapi.Task
	f.c.Post(tasksPath(f.mom), httpapi.TaskInput{Title: "Write the birth plan"}, http.StatusCreated, &task)
	id := task.Id.String()

	// The partner cannot take the task by offering it to themselves or back to mom.
	f.c.Post(tasksPath(f.partner)+"/"+id+"/reassignment", httpapi.TaskReassignmentInput{ToMemberId: f.partner.Id}, http.StatusConflict, nil)
	f.c.Post(tasksPath(f.partner)+"/"+id+"/reassignment", httpapi.TaskReassignmentInput{ToMemberId: f.mom.Id}, http.StatusConflict, nil)
	// Mom cannot offer it to herself.
	f.c.Post(tasksPath(f.mom)+"/"+id+"/reassignment", httpapi.TaskReassignmentInput{ToMemberId: f.mom.Id}, http.StatusConflict, nil)
	if got := f.get(t, task.Id); got.AssigneeId != f.mom.Id || got.PendingAssigneeId != nil {
		t.Fatalf("refused offers must not change the task, got %+v", got)
	}
}

func TestTasksStayInTheirFamily(t *testing.T) {
	c := testutil.New(t)
	other := c.StartDemo("pregnancy")
	strangerMom := testutil.Parent(t, other, httpapi.ParentRoleMother)
	var strangerTask httpapi.Task
	c.Post(tasksPath(strangerMom), httpapi.TaskInput{Title: "Other family"}, http.StatusCreated, &strangerTask)

	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var mine httpapi.Task
	c.Post(tasksPath(mom), httpapi.TaskInput{Title: "Mine"}, http.StatusCreated, &mine)

	var l httpapi.TaskList
	c.Get(tasksPath(mom), http.StatusOK, &l)
	for _, it := range l.Items {
		if it.Id == strangerTask.Id {
			t.Fatal("another family's task is listed")
		}
	}
	c.Get(tasksPath(strangerMom), http.StatusNotFound, nil)
	c.Post(tasksPath(mom)+"/"+strangerTask.Id.String()+"/reassignment", httpapi.TaskReassignmentInput{ToMemberId: mom.Id}, http.StatusNotFound, nil)
	c.Post(tasksPath(mom)+"/"+strangerTask.Id.String()+"/reassignment/accept", nil, http.StatusNotFound, nil)
	// Offering my task to a parent from another family.
	c.Post(tasksPath(mom)+"/"+mine.Id.String()+"/reassignment", httpapi.TaskReassignmentInput{ToMemberId: strangerMom.Id}, http.StatusNotFound, nil)
}
