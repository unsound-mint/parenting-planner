// Package insurance keeps the log of a parent's calls with the health insurer.
// Built like internal/wellbeing: each create and each list runs in one
// transaction with access.Audit, and reads use the *VisibleToParent SQL.
package insurance

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "insurance_call"

// ListWindow is how far back the list looks.
const ListWindow = 365 * 24 * time.Hour

type NewCall struct {
	CalledAt        time.Time
	Insurer         string
	Representative  *string
	ReferenceNumber *string
	Topic           string
	Summary         string
	FollowUpOn      *time.Time
	Visibility      access.Visibility
}

func Create(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewCall) (store.InsuranceCall, error) {
	var out store.InsuranceCall
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		c, err := q.CreateInsuranceCall(ctx, store.CreateInsuranceCallParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility), CalledAt: in.CalledAt, Insurer: in.Insurer,
			Representative: in.Representative, ReferenceNumber: in.ReferenceNumber, Topic: in.Topic, Summary: in.Summary, FollowUpOn: in.FollowUpOn,
		})
		if err != nil {
			return err
		}
		out = c
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entity, c.ID.String())
	})
	return out, err
}

func List(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, now time.Time) ([]store.InsuranceCall, error) {
	var out []store.InsuranceCall
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListInsuranceCallsVisibleToParent(ctx, store.ListInsuranceCallsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: now.Add(-ListWindow),
		})
		if err != nil {
			return err
		}
		out = rows
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entity, "")
	})
	return out, err
}
