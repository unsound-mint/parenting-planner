// Package notify writes and reads the bell's notifications (tag
// notifications in openapi.yaml).
//
// Modules call Send inside their own transaction, right after the change that
// caused it, so a notification exists exactly when the change does. Send picks
// no recipients itself: the caller passes the person who may read the record
// (see NotificationKind in openapi.yaml). Titles are fixed templates with
// names and dates only; never put a health value, a lab name, diary or mood
// text, screening answers or a session note in one. Nothing from mood, diary,
// screening or session notes creates a notification for anyone else.
//
// Not wired yet, because the pieces are not on main: the live update of kind
// notification (#241) and suppressing pregnancy and baby kinds while the family
// is in pregnancy loss support (#275). Both belong in Send.
package notify

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Kind mirrors NotificationKind in openapi.yaml and the CHECK in the migration.
type Kind string

const (
	TaskOffered         Kind = "task_offered"
	TaskOfferAnswered   Kind = "task_offer_answered"
	HandoffReceived     Kind = "handoff_received"
	HandoffAccepted     Kind = "handoff_accepted"
	PlanItemDue         Kind = "plan_item_due"
	ValueFlagged        Kind = "value_flagged"
	AppointmentReminder Kind = "appointment_reminder"
	InvitationAccepted  Kind = "invitation_accepted"
	SubscriptionStarted Kind = "subscription_started"
)

// Window is how far back List looks; Limit is the most it returns.
const (
	Window = 30 * 24 * time.Hour
	Limit  = 50
)

// Notification is one row to write.
type Notification struct {
	FamilyID    uuid.UUID
	RecipientID uuid.UUID
	Kind        Kind
	// EntityID is the record to open: a uuid, or a rule id for plan_item_due.
	EntityID string
	// ActorID is who caused it, when a person did.
	ActorID *uuid.UUID
	Title   string
	// At is the family's demo clock (s.now(ctx)), never the SQL default.
	At time.Time
	// OnDay, when set, makes the row unique per recipient, kind, entity and
	// day; a second Send for the same day is a no-op. Only for notifications
	// computed on read.
	OnDay *time.Time
}

// Send writes one notification with q, the caller's transaction.
func Send(ctx context.Context, q *store.Queries, n Notification) error {
	var entity *string
	if n.EntityID != "" {
		entity = &n.EntityID
	}
	var actor uuid.NullUUID
	if n.ActorID != nil {
		actor = uuid.NullUUID{UUID: *n.ActorID, Valid: true}
	}
	_, err := q.CreateNotification(ctx, store.CreateNotificationParams{
		FamilyID: n.FamilyID, RecipientMemberID: n.RecipientID, Kind: string(n.Kind),
		EntityID: entity, ActorMemberID: actor, Title: n.Title, OnDay: n.OnDay, CreatedAt: n.At.UTC(),
	})
	return err
}

// LabFlagged tells whoever owns an out-of-range lab value: the parent it is
// about, or both parents for a child's value (CanParentReadHealthRecord opens
// a child's records to both). Never caregivers, never the other parent for a
// parent's own record. The title names the child at most, never the lab.
func LabFlagged(ctx context.Context, q *store.Queries, familyID uuid.UUID, lab store.LabResult, actor uuid.UUID, now time.Time) error {
	title := "A lab result is outside the usual range"
	recipients := []uuid.UUID{lab.OwnerMemberID}
	if lab.SubjectChildID.Valid {
		children, err := q.ListChildren(ctx, familyID)
		if err != nil {
			return err
		}
		for _, c := range children {
			if c.ID == lab.SubjectChildID.UUID {
				title = "A lab result for " + c.Name + " is outside the usual range"
			}
		}
		parents, err := q.ListFamilyParents(ctx, familyID)
		if err != nil {
			return err
		}
		recipients = recipients[:0]
		for _, p := range parents {
			recipients = append(recipients, p.ID)
		}
	}
	for _, r := range recipients {
		if err := Send(ctx, q, Notification{
			FamilyID: familyID, RecipientID: r, Kind: ValueFlagged, EntityID: lab.ID.String(),
			ActorID: &actor, Title: title, At: now,
		}); err != nil {
			return err
		}
	}
	return nil
}

// PlanItemsDue writes plan_item_due for the member's own plan items that are
// due or overdue and not yet marked done or booked, at most once per rule and
// day. It runs when the plan is read, instead of a scheduler. The title gives
// the date only: rule titles can name a test, and this text may show up as a
// browser notification.
func PlanItemsDue(ctx context.Context, pool *pgxpool.Pool, familyID, memberID uuid.UUID, items []rules.Item, today, now time.Time) error {
	var due []rules.Item
	for _, it := range items {
		if (it.Status == rules.Due || it.Status == rules.Overdue) && it.Progress == "" {
			due = append(due, it)
		}
	}
	if len(due) == 0 {
		return nil
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		for _, it := range due {
			if err := Send(ctx, q, Notification{
				FamilyID: familyID, RecipientID: memberID, Kind: PlanItemDue, EntityID: it.RuleID,
				Title: planItemTitle(it), At: now, OnDay: &today,
			}); err != nil {
				return err
			}
		}
		return nil
	})
}

func planItemTitle(it rules.Item) string {
	switch {
	case it.Status == rules.Overdue:
		return "An item on your plan is overdue"
	case it.DueBy != nil:
		return "An item on your plan is due by " + it.DueBy.Format("Jan 2")
	default:
		return "An item on your plan is due"
	}
}

// List returns the viewer's own notifications from the last Window, newest
// first, at most Limit, and the unread count over the same window.
func List(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]store.Notification, int64, error) {
	q := store.New(pool)
	since := now.Add(-Window)
	rows, err := q.ListNotificationsForRecipient(ctx, store.ListNotificationsForRecipientParams{FamilyID: familyID, RecipientID: viewer, Since: since})
	if err != nil {
		return nil, 0, err
	}
	unread, err := q.CountUnreadNotifications(ctx, store.CountUnreadNotificationsParams{FamilyID: familyID, RecipientID: viewer, Since: since})
	return rows, unread, err
}

// MarkRead marks the viewer's notifications as read: the given ids, or all
// unread ones when ids is nil. Ids that are not the viewer's are ignored.
func MarkRead(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, ids []uuid.UUID, now time.Time) error {
	q := store.New(pool)
	at := pgTime(now)
	if ids == nil {
		return q.MarkAllNotificationsRead(ctx, store.MarkAllNotificationsReadParams{ReadAt: at, FamilyID: familyID, RecipientID: viewer})
	}
	if len(ids) == 0 {
		return nil
	}
	return q.MarkNotificationsRead(ctx, store.MarkNotificationsReadParams{ReadAt: at, FamilyID: familyID, RecipientID: viewer, Ids: ids})
}

func pgTime(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t.UTC(), Valid: true}
}
