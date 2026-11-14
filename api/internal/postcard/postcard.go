// Package postcard holds the weekly postcard's own data: the line parents
// share for a week and the hearts grandparents send back (tag postcard in
// openapi.yaml). The card's content comes from the reference catalogs in
// package content; nothing here reads a diary, mood check-in, lab or session
// note, which is why none of these functions audits or filters by visibility.
package postcard

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/notify"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// LoveWindow is how far back loves are listed.
const LoveWindow = 7 * 24 * time.Hour

// PregnancyKey is the period key of a pregnancy week.
func PregnancyKey(week int) string { return fmt.Sprintf("pregnancy:%d", week) }

// ChildKey is the period key of a baby's week of life on today.
func ChildKey(birth, today time.Time) string {
	days := max(int(today.Sub(birth).Hours()/24), 0)
	return fmt.Sprintf("child:%d", days/7)
}

// Line is the text parents shared for one period.
type Line struct {
	Text       string
	AuthorName string
	UpdatedAt  time.Time
}

// GetLine returns the family's line for the period, or nil.
func GetLine(ctx context.Context, q *store.Queries, familyID uuid.UUID, key string) (*Line, error) {
	row, err := q.GetPostcardLine(ctx, store.GetPostcardLineParams{FamilyID: familyID, PeriodKey: key})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &Line{Text: row.Body, AuthorName: row.AuthorName, UpdatedAt: row.UpdatedAt.UTC()}, nil
}

// SetLine saves the line for the period; blank text clears it.
func SetLine(ctx context.Context, q *store.Queries, familyID uuid.UUID, key string, author store.Member, text string, now time.Time) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return q.DeletePostcardLine(ctx, store.DeletePostcardLineParams{FamilyID: familyID, PeriodKey: key})
	}
	_, err := q.UpsertPostcardLine(ctx, store.UpsertPostcardLineParams{
		FamilyID: familyID, PeriodKey: key, AuthorMemberID: uuid.NullUUID{UUID: author.ID, Valid: true},
		AuthorName: author.DisplayName, Body: text, UpdatedAt: now.UTC(),
	})
	return err
}

// Love is one heart.
type Love struct {
	ID       uuid.UUID
	FromName string
	Message  string
	SentAt   time.Time
}

// Loves lists the hearts of the last LoveWindow, newest first. from limits it
// to one sender (a grandparent sees only their own); nil lists every heart.
func Loves(ctx context.Context, q *store.Queries, familyID uuid.UUID, from *uuid.UUID, now time.Time) ([]Love, error) {
	p := store.ListPostcardLovesParams{FamilyID: familyID, Since: now.Add(-LoveWindow)}
	if from != nil {
		p.FromMemberID = uuid.NullUUID{UUID: *from, Valid: true}
	}
	rows, err := q.ListPostcardLoves(ctx, p)
	if err != nil {
		return nil, err
	}
	out := make([]Love, 0, len(rows))
	for _, r := range rows {
		l := Love{ID: r.ID, FromName: r.FromName, SentAt: r.CreatedAt.UTC()}
		if r.Message != nil {
			l.Message = *r.Message
		}
		out = append(out, l)
	}
	return out, nil
}

// SendLove stores a heart and tells both parents, in one transaction. The
// bell gets at most one notification per sender and day (notify.Notification.OnDay);
// every heart is kept.
func SendLove(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, from store.Member, message string, today, now time.Time) error {
	message = strings.TrimSpace(message)
	var msg *string
	if message != "" {
		msg = &message
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.CreatePostcardLove(ctx, store.CreatePostcardLoveParams{FamilyID: familyID, FromMemberID: from.ID, Message: msg, CreatedAt: now.UTC()}); err != nil {
			return err
		}
		parents, err := q.ListFamilyParents(ctx, familyID)
		if err != nil {
			return err
		}
		for _, p := range parents {
			if err := notify.Send(ctx, q, notify.Notification{
				FamilyID: familyID, RecipientID: p.ID, Kind: notify.LoveSent, EntityID: from.ID.String(),
				ActorID: &from.ID, Title: from.DisplayName + " sent love", At: now, OnDay: &today,
			}); err != nil {
				return err
			}
		}
		return nil
	})
}
