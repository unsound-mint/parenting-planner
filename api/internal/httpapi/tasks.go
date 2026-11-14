package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

var (
	errNoFamilyPlan   = Error{Code: "forbidden", Message: "you do not have access to the family plan"}
	errTaskForbidden  = Error{Code: "forbidden", Message: "only the assignee or a parent may change this task"}
	errNoTask         = Error{Code: "not_found", Message: "no such task"}
	errBadBag         = Error{Code: "invalid_request", Message: "a hospital bag item needs bag, and only a hospital bag item has one"}
	errNotAssignee    = Error{Code: "not_assignee", Message: "only the assignee can offer the task"}
	errInvalidOffer   = Error{Code: "invalid_offer", Message: "a task cannot be offered to its own assignee"}
	errBadTaskTarget  = Error{Code: "bad_assignee", Message: "the task can be offered to a parent or to a caregiver with family_plan"}
	errNotOffered     = Error{Code: "not_offered", Message: "this task has no open offer"}
	errNotOfferedToMe = Error{Code: "not_offered_to_you", Message: "this task was not offered to you"}
)

func taskPerson(m store.Member) tasks.Person {
	return tasks.Person{ID: m.ID, Role: m.Role, Permissions: m.Permissions}
}

func taskOut(it tasks.Item) Task {
	t := it.Task
	out := Task{
		Id: t.ID, Title: t.Title, AssigneeId: t.AssigneeMemberID, Kind: TaskKind(t.Kind), Detail: t.Detail,
		Done: t.Done,
	}
	if it.Deadline.On != nil {
		out.DueOn = &openapi_types.Date{Time: *it.Deadline.On}
	}
	if it.Deadline.Anchor != nil {
		a := TaskDueAnchor(*it.Deadline.Anchor)
		out.DueAnchor = &a
	}
	out.DueOffsetDays = it.Deadline.Offset
	if t.PendingAssigneeMemberID.Valid {
		id := t.PendingAssigneeMemberID.UUID
		out.PendingAssigneeId = &id
	}
	if t.Bag != nil {
		b := HospitalBag(*t.Bag)
		out.Bag = &b
	}
	if t.DoneAt.Valid {
		out.DoneAt = &t.DoneAt.Time
	}
	if t.DoneByMemberID.Valid {
		id := t.DoneByMemberID.UUID
		out.DoneById = &id
	}
	if t.SourceTitle != nil && t.SourceUrl != nil && t.SourceCheckedOn != nil {
		out.Source = &Source{Title: *t.SourceTitle, Url: *t.SourceUrl, CheckedAt: openapi_types.Date{Time: *t.SourceCheckedOn}}
	}
	return out
}

// oneTask resolves a task's deadline for a single response.
func (s *Server) oneTask(ctx context.Context, familyID uuid.UUID, t store.Task) (Task, error) {
	a, _, err := tasks.LoadAnchors(ctx, s.q, familyID)
	if err != nil {
		return Task{}, err
	}
	return taskOut(tasks.Item{Task: t, Deadline: tasks.Resolve(t, a)}), nil
}

func (s *Server) CreateTask(ctx context.Context, req CreateTaskRequestObject) (CreateTaskResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateTask401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateTask404JSONResponse(errNoMember), nil
	case !taskPerson(m).CanUse():
		return CreateTask403JSONResponse(errNoFamilyPlan), nil
	}
	b := req.Body
	in := tasks.Input{Kind: "task", Title: b.Title, Detail: b.Detail}
	if b.Kind != nil {
		in.Kind = string(*b.Kind)
	}
	if b.Bag != nil {
		v := string(*b.Bag)
		in.Bag = &v
	}
	if b.DueOn != nil {
		in.DueOn = &b.DueOn.Time
	}
	t, err := tasks.Create(ctx, s.pool, familyID, taskPerson(m), in, s.now(ctx))
	switch {
	case errors.Is(err, tasks.ErrBadBag):
		return CreateTask400JSONResponse(errBadBag), nil
	case err != nil:
		return nil, err
	}
	out, err := s.oneTask(ctx, familyID, t)
	if err != nil {
		return nil, err
	}
	return CreateTask201JSONResponse(out), nil
}

func (s *Server) ListTasks(ctx context.Context, req ListTasksRequestObject) (ListTasksResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListTasks401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListTasks404JSONResponse(errNoMember), nil
	case !taskPerson(m).CanUse():
		return ListTasks403JSONResponse(errNoFamilyPlan), nil
	}
	var k *string
	if req.Params.Kind != nil {
		v := string(*req.Params.Kind)
		k = &v
	}
	items, err := tasks.List(ctx, s.pool, familyID, k)
	if err != nil {
		return nil, err
	}
	out := TaskList{Items: make([]Task, 0, len(items))}
	for _, it := range items {
		out.Items = append(out.Items, taskOut(it))
	}
	return ListTasks200JSONResponse(out), nil
}

func (s *Server) UpdateTask(ctx context.Context, req UpdateTaskRequestObject) (UpdateTaskResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateTask401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateTask404JSONResponse(errNoMember), nil
	}
	t, err := tasks.SetDone(ctx, s.pool, familyID, taskPerson(m), req.TaskId, req.Body.Done, s.now(ctx))
	switch {
	case errors.Is(err, tasks.ErrNotFound):
		return UpdateTask404JSONResponse(errNoTask), nil
	case errors.Is(err, tasks.ErrForbidden):
		return UpdateTask403JSONResponse(errTaskForbidden), nil
	case err != nil:
		return nil, err
	}
	out, err := s.oneTask(ctx, familyID, t)
	if err != nil {
		return nil, err
	}
	return UpdateTask200JSONResponse(out), nil
}

func (s *Server) ProposeTaskReassignment(ctx context.Context, req ProposeTaskReassignmentRequestObject) (ProposeTaskReassignmentResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ProposeTaskReassignment401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ProposeTaskReassignment404JSONResponse(errNoMember), nil
	}
	t, err := tasks.Propose(ctx, s.pool, familyID, taskPerson(m), req.TaskId, req.Body.ToMemberId, s.now(ctx))
	switch {
	case errors.Is(err, tasks.ErrNotFound):
		return ProposeTaskReassignment404JSONResponse(errNoTask), nil
	case errors.Is(err, tasks.ErrNotAssignee):
		return ProposeTaskReassignment409JSONResponse(errNotAssignee), nil
	case errors.Is(err, tasks.ErrInvalidOffer):
		return ProposeTaskReassignment409JSONResponse(errInvalidOffer), nil
	case errors.Is(err, tasks.ErrBadAssignee):
		return ProposeTaskReassignment400JSONResponse(errBadTaskTarget), nil
	case err != nil:
		return nil, err
	}
	out, err := s.oneTask(ctx, familyID, t)
	if err != nil {
		return nil, err
	}
	return ProposeTaskReassignment200JSONResponse(out), nil
}

func (s *Server) AcceptTaskReassignment(ctx context.Context, req AcceptTaskReassignmentRequestObject) (AcceptTaskReassignmentResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return AcceptTaskReassignment401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return AcceptTaskReassignment404JSONResponse(errNoMember), nil
	}
	t, err := tasks.Accept(ctx, s.pool, familyID, taskPerson(m), req.TaskId, s.now(ctx))
	switch {
	case errors.Is(err, tasks.ErrNotFound):
		return AcceptTaskReassignment404JSONResponse(errNoTask), nil
	case errors.Is(err, tasks.ErrNotOfferedTo):
		return AcceptTaskReassignment409JSONResponse(errNotOfferedToMe), nil
	case err != nil:
		return nil, err
	}
	out, err := s.oneTask(ctx, familyID, t)
	if err != nil {
		return nil, err
	}
	return AcceptTaskReassignment200JSONResponse(out), nil
}

func (s *Server) DeclineTaskReassignment(ctx context.Context, req DeclineTaskReassignmentRequestObject) (DeclineTaskReassignmentResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeclineTaskReassignment401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeclineTaskReassignment404JSONResponse(errNoMember), nil
	}
	t, err := tasks.Decline(ctx, s.pool, familyID, taskPerson(m), req.TaskId, s.now(ctx))
	switch {
	case errors.Is(err, tasks.ErrNotFound):
		return DeclineTaskReassignment404JSONResponse(errNoTask), nil
	case errors.Is(err, tasks.ErrNotOfferedTo):
		return DeclineTaskReassignment409JSONResponse(errNotOfferedToMe), nil
	case err != nil:
		return nil, err
	}
	out, err := s.oneTask(ctx, familyID, t)
	if err != nil {
		return nil, err
	}
	return DeclineTaskReassignment200JSONResponse(out), nil
}

func (s *Server) WithdrawTaskReassignment(ctx context.Context, req WithdrawTaskReassignmentRequestObject) (WithdrawTaskReassignmentResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return WithdrawTaskReassignment401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return WithdrawTaskReassignment404JSONResponse(errNoMember), nil
	}
	t, err := tasks.Withdraw(ctx, s.pool, familyID, taskPerson(m), req.TaskId, s.now(ctx))
	switch {
	case errors.Is(err, tasks.ErrNotFound):
		return WithdrawTaskReassignment404JSONResponse(errNoTask), nil
	case errors.Is(err, tasks.ErrNotAssignee):
		return WithdrawTaskReassignment409JSONResponse(errNotAssignee), nil
	case errors.Is(err, tasks.ErrNoOffer):
		return WithdrawTaskReassignment409JSONResponse(errNotOffered), nil
	case err != nil:
		return nil, err
	}
	out, err := s.oneTask(ctx, familyID, t)
	if err != nil {
		return nil, err
	}
	return WithdrawTaskReassignment200JSONResponse(out), nil
}
