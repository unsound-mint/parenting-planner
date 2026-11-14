// Package capsule is the time capsule: letters a parent writes to their child,
// to open on a chosen date. Built like internal/diary: each call runs in one
// transaction with access.Audit, reads use the *VisibleToParent SQL, and the
// text is encrypted at rest. The partner sees that a letter exists but gets the
// text only when the author shares it. Caregivers never reach it.
package capsule

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "time_capsule_letter"

var (
	ErrNoLetter   = errors.New("no such letter")
	ErrBadInput   = errors.New("invalid letter")
	ErrDateInPast = errors.New("the opening date is not in the future")
)

// Letter has Body set only when the viewer may read it.
type Letter struct {
	ID, OwnerID uuid.UUID
	ChildID     *uuid.UUID
	Visibility  access.Visibility
	Occasion    string
	OpensOn     time.Time
	Body        *string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Input struct {
	Occasion   string
	OpensOn    time.Time
	Body       string
	Visibility access.Visibility
	ChildID    *uuid.UUID
}

func clean(in Input) (Input, error) {
	in.Occasion = strings.Join(strings.Fields(in.Occasion), " ")
	in.Body = strings.TrimSpace(in.Body)
	if in.Occasion == "" || len(in.Occasion) > 60 || in.Body == "" || len(in.Body) > 8000 {
		return in, ErrBadInput
	}
	if in.Visibility != access.Private && in.Visibility != access.Partner {
		return in, ErrBadInput
	}
	return in, nil
}

func fromRow(key crypt.Key, id, owner uuid.UUID, child *uuid.UUID, v, occasion string, opens time.Time, sealed []byte, created, updated time.Time) (Letter, error) {
	l := Letter{ID: id, OwnerID: owner, ChildID: child, Visibility: access.Visibility(v), Occasion: occasion, OpensOn: opens, CreatedAt: created, UpdatedAt: updated}
	if sealed != nil {
		body, err := key.Open(sealed)
		if err != nil {
			return l, err
		}
		l.Body = &body
	}
	return l, nil
}

func List(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, viewer uuid.UUID) ([]Letter, error) {
	var out []Letter
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListLettersVisibleToParent(ctx, store.ListLettersVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
		if err != nil {
			return err
		}
		for _, r := range rows {
			l, err := fromRow(key, r.ID, r.OwnerMemberID, ptrID(r.ChildID), r.Visibility, r.Occasion, r.OpensOn, r.BodySealed, r.CreatedAt, r.UpdatedAt)
			if errors.Is(err, crypt.ErrCannotDecrypt) {
				// Sealed with an earlier ephemeral key: leave the text out, keep the envelope.
				l.Body = nil
				out = append(out, l)
				continue
			}
			if err != nil {
				return err
			}
			out = append(out, l)
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	return out, err
}

// Create seals a letter. The opening date must be after today.
func Create(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, actor uuid.UUID, in Input, today, now time.Time) (Letter, error) {
	in, err := clean(in)
	if err != nil {
		return Letter{}, err
	}
	if !in.OpensOn.After(today) {
		return Letter{}, ErrDateInPast
	}
	sealed, err := key.Seal(in.Body)
	if err != nil {
		return Letter{}, err
	}
	var out Letter
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.CreateLetter(ctx, store.CreateLetterParams{
			FamilyID: familyID, OwnerMemberID: actor, ChildID: nullID(in.ChildID), Visibility: string(in.Visibility),
			Occasion: in.Occasion, OpensOn: in.OpensOn, BodySealed: sealed, Now: now,
		})
		if err != nil {
			return err
		}
		body := in.Body
		out = Letter{ID: row.ID, OwnerID: actor, ChildID: ptrID(row.ChildID), Visibility: in.Visibility, Occasion: row.Occasion, OpensOn: row.OpensOn, Body: &body, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt}
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entity, row.ID.String())
	})
	return out, err
}

// Update lets the author change a letter. A date that did not change is not
// checked, so a letter whose date has passed can still be edited and shared.
func Update(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, actor, id uuid.UUID, in Input, today, now time.Time) (Letter, error) {
	in, err := clean(in)
	if err != nil {
		return Letter{}, err
	}
	sealed, err := key.Seal(in.Body)
	if err != nil {
		return Letter{}, err
	}
	var out Letter
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		cur, err := q.GetOwnLetterVisibleToParent(ctx, store.GetOwnLetterVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoLetter
		}
		if err != nil {
			return err
		}
		if !in.OpensOn.Equal(cur.OpensOn) && !in.OpensOn.After(today) {
			return ErrDateInPast
		}
		row, err := q.UpdateOwnLetterVisibleToParent(ctx, store.UpdateOwnLetterVisibleToParentParams{
			ID: id, FamilyID: familyID, ViewerID: actor, Occasion: in.Occasion, OpensOn: in.OpensOn,
			Visibility: string(in.Visibility), BodySealed: sealed, Now: now,
		})
		if err != nil {
			return err
		}
		body := in.Body
		out = Letter{ID: row.ID, OwnerID: actor, ChildID: ptrID(row.ChildID), Visibility: in.Visibility, Occasion: row.Occasion, OpensOn: row.OpensOn, Body: &body, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entity, id.String())
	})
	return out, err
}

func Delete(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.DeleteOwnLetterVisibleToParent(ctx, store.DeleteOwnLetterVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor})
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNoLetter
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entity, id.String())
	})
}

func nullID(p *uuid.UUID) uuid.NullUUID {
	if p == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *p, Valid: true}
}

func ptrID(n uuid.NullUUID) *uuid.UUID {
	if !n.Valid {
		return nil
	}
	return &n.UUID
}
