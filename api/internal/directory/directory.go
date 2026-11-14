// Package directory owns the provider directory and booking requests.
//
// Providers are global synthetic demo data, the same for every family, so
// reading them is not audited. Booking requests are sensitive (they can reveal
// that a parent is seeking care): they follow the wellbeing pattern, run in a
// transaction with access.Audit, and only the parent who made one can read it.
package directory

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entityBookingRequest = "booking_request"

var (
	// ErrUnknownProvider means the provider id is not in the directory.
	ErrUnknownProvider = errors.New("unknown provider")
	// ErrAlreadyRequested means this parent already asked this provider.
	ErrAlreadyRequested = errors.New("booking already requested")
)

// Filter narrows ListProviders; nil fields mean no filter.
type Filter struct {
	Type  *string
	State *string
}

// ListProviders returns the directory sorted by next available date, soonest
// first. Next available dates are relative to today, so they never go stale.
func ListProviders(ctx context.Context, pool *pgxpool.Pool, today time.Time, f Filter) ([]store.ListProvidersRow, error) {
	return store.New(pool).ListProviders(ctx, store.ListProvidersParams{Today: today, Type: f.Type, State: f.State})
}

type NewBookingRequest struct {
	ProviderID uuid.UUID
	Note       *string
	CreatedAt  time.Time
}

func CreateBookingRequest(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewBookingRequest) (store.BookingRequest, error) {
	var out store.BookingRequest
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		ok, err := q.ProviderExists(ctx, in.ProviderID)
		if err != nil {
			return err
		}
		if !ok {
			return ErrUnknownProvider
		}
		b, err := q.CreateBookingRequest(ctx, store.CreateBookingRequestParams{
			FamilyID: familyID, OwnerMemberID: actor, ProviderID: in.ProviderID, Note: in.Note, CreatedAt: in.CreatedAt,
		})
		if pgErr := (*pgconn.PgError)(nil); errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrAlreadyRequested
		}
		if err != nil {
			return err
		}
		out = b
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityBookingRequest, b.ID.String())
	})
	return out, err
}

// ListBookingRequests returns the viewer's own requests, newest first. There is
// no time window: a parent can ask each provider once, so the list is bounded
// by the directory size.
func ListBookingRequests(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID) ([]store.BookingRequest, error) {
	var out []store.BookingRequest
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListBookingRequestsVisibleToParent(ctx, store.ListBookingRequestsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer,
		})
		if err != nil {
			return err
		}
		out = rows
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityBookingRequest, "")
	})
	return out, err
}
