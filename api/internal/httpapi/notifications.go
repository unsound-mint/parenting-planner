package httpapi

import (
	"context"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/notify"
	"github.com/unsound-mint/parenting-planner/api/internal/plan"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// ListNotifications is the bell. plan_item_due is computed on read rather
// than by a scheduler, so the bell refreshes the acting parent's plan items
// first (once per rule and day).
func (s *Server) ListNotifications(ctx context.Context, req ListNotificationsRequestObject) (ListNotificationsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListNotifications401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListNotifications404JSONResponse(errNoMember), nil
	}
	if err := s.notifyPlanItemsDue(ctx, familyID, req.MemberId); err != nil {
		return nil, err
	}
	out, err := s.notificationList(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	return ListNotifications200JSONResponse(out), nil
}

func (s *Server) MarkNotificationsRead(ctx context.Context, req MarkNotificationsReadRequestObject) (MarkNotificationsReadResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return MarkNotificationsRead401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return MarkNotificationsRead404JSONResponse(errNoMember), nil
	}
	var ids []uuid.UUID
	if req.Body.Ids != nil {
		ids = append([]uuid.UUID{}, *req.Body.Ids...)
	}
	if err := notify.MarkRead(ctx, s.pool, familyID, req.MemberId, ids, s.now(ctx)); err != nil {
		return nil, err
	}
	out, err := s.notificationList(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	return MarkNotificationsRead200JSONResponse(out), nil
}

// notifyPlanItemsDue writes plan_item_due for one parent's own plan.
func (s *Server) notifyPlanItemsDue(ctx context.Context, familyID, memberID uuid.UUID) error {
	items, err := plan.ForMember(ctx, s.q, familyID, memberID, s.today(ctx), s.now(ctx))
	if err != nil {
		return err
	}
	return notify.PlanItemsDue(ctx, s.pool, familyID, memberID, items, s.today(ctx), s.now(ctx))
}

func (s *Server) notificationList(ctx context.Context, familyID, viewer uuid.UUID) (NotificationList, error) {
	rows, unread, err := notify.List(ctx, s.pool, familyID, viewer, s.now(ctx))
	if err != nil {
		return NotificationList{}, err
	}
	out := NotificationList{Items: make([]Notification, 0, len(rows)), UnreadCount: int(unread)}
	for _, n := range rows {
		out.Items = append(out.Items, notificationOut(n))
	}
	return out, nil
}

func notificationOut(n store.Notification) Notification {
	out := Notification{Id: n.ID, Kind: NotificationKind(n.Kind), Title: n.Title, EntityId: n.EntityID, CreatedAt: n.CreatedAt.UTC()}
	if n.ActorMemberID.Valid {
		out.ActorId = &n.ActorMemberID.UUID
	}
	if n.ReadAt.Valid {
		t := n.ReadAt.Time.UTC()
		out.ReadAt = &t
	}
	return out
}
