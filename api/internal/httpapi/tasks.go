package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

func (s *Server) CreateTask(ctx context.Context, req CreateTaskRequestObject) (CreateTaskResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateTask401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateTask404JSONResponse(errNoMember), nil
	}
	in := tasks.NewTask{Title: req.Body.Title, CreatedAt: s.cfg.Now()}
	if req.Body.DueOn != nil {
		in.DueOn = &req.Body.DueOn.Time
	}
	t, err := tasks.Create(ctx, s.pool, familyID, req.MemberId, in)
	if err != nil {
		return nil, err
	}
	return CreateTask201JSONResponse(taskOut(t)), nil
}

func (s *Server) ListTasks(ctx context.Context, req ListTasksRequestObject) (ListTasksResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListTasks401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListTasks404JSONResponse(errNoMember), nil
	}
	rows, err := tasks.List(ctx, s.pool, familyID)
	if err != nil {
		return nil, err
	}
	out := TaskList{Items: make([]Task, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, taskOut(r))
	}
	return ListTasks200JSONResponse(out), nil
}

func (s *Server) ProposeTaskReassignment(ctx context.Context, req ProposeTaskReassignmentRequestObject) (ProposeTaskReassignmentResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ProposeTaskReassignment401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ProposeTaskReassignment404JSONResponse(errNoMember), nil
	}
	t, err := tasks.Propose(ctx, s.pool, familyID, req.MemberId, req.TaskId, req.Body.ToMemberId)
	switch {
	case errors.Is(err, tasks.ErrNoTask):
		return ProposeTaskReassignment404JSONResponse(errNoTask), nil
	case errors.Is(err, tasks.ErrNoTarget):
		return ProposeTaskReassignment404JSONResponse(errNoMember), nil
	case errors.Is(err, tasks.ErrNotAssignee):
		return ProposeTaskReassignment409JSONResponse(errNotAssignee), nil
	case err != nil:
		return nil, err
	}
	return ProposeTaskReassignment200JSONResponse(taskOut(t)), nil
}

func (s *Server) AcceptTaskReassignment(ctx context.Context, req AcceptTaskReassignmentRequestObject) (AcceptTaskReassignmentResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return AcceptTaskReassignment401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return AcceptTaskReassignment404JSONResponse(errNoMember), nil
	}
	t, err := tasks.Accept(ctx, s.pool, familyID, req.MemberId, req.TaskId)
	switch {
	case errors.Is(err, tasks.ErrNoTask):
		return AcceptTaskReassignment404JSONResponse(errNoTask), nil
	case errors.Is(err, tasks.ErrNotOffered):
		return AcceptTaskReassignment409JSONResponse(errNotOffered), nil
	case err != nil:
		return nil, err
	}
	return AcceptTaskReassignment200JSONResponse(taskOut(t)), nil
}

func (s *Server) DeclineTaskReassignment(ctx context.Context, req DeclineTaskReassignmentRequestObject) (DeclineTaskReassignmentResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeclineTaskReassignment401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeclineTaskReassignment404JSONResponse(errNoMember), nil
	}
	t, err := tasks.Decline(ctx, s.pool, familyID, req.MemberId, req.TaskId)
	switch {
	case errors.Is(err, tasks.ErrNoTask):
		return DeclineTaskReassignment404JSONResponse(errNoTask), nil
	case errors.Is(err, tasks.ErrNotOffered):
		return DeclineTaskReassignment409JSONResponse(errNotOffered), nil
	case err != nil:
		return nil, err
	}
	return DeclineTaskReassignment200JSONResponse(taskOut(t)), nil
}

func taskOut(t store.Task) Task {
	out := Task{Id: t.ID, Title: t.Title, AssigneeId: t.AssigneeMemberID}
	if t.DueOn != nil {
		out.DueOn = &openapi_types.Date{Time: *t.DueOn}
	}
	if t.PendingAssigneeMemberID.Valid {
		out.PendingAssigneeId = &t.PendingAssigneeMemberID.UUID
	}
	return out
}
