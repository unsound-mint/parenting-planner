// Package account is account deletion and data export in the demo, where the
// account is the family behind the session cookie.
//
// Built like internal/wellbeing: functions take the pool, the family id and
// the acting member id and run in one transaction. The export reads only
// through the *VisibleToParent queries (and the passport and care helpers
// that use them), so it holds exactly what the parent may see on screen, and
// every sensitive read is audited.
package account

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/care"
	"github.com/unsound-mint/parenting-planner/api/internal/passport"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const (
	entityExport      = "member_export"
	entityMoodCheckin = "mood_checkin"
	entityBooking     = "psychologist_booking"
	entitySessionNote = "session_note"
)

// Export is everything one parent may see, newest first.
type Export struct {
	Passport     []passport.Person
	MoodCheckins []store.MoodCheckin
	Bookings     []care.Booking
	SessionNotes []store.SessionNote
	PlanProgress []store.PlanItemProgress
}

// ExportFor reads the viewer's data export. Lists have no time window.
func ExportFor(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, today time.Time) (Export, error) {
	var out Export
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		// Audits the lab and allergy reads itself.
		if out.Passport, err = passport.Read(ctx, q, familyID, viewer, today); err != nil {
			return err
		}
		if out.MoodCheckins, err = q.ListMoodCheckinsVisibleToParent(ctx, store.ListMoodCheckinsVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: time.Time{},
		}); err != nil {
			return err
		}
		if out.Bookings, err = care.OwnBookings(ctx, q, familyID, viewer); err != nil {
			return err
		}
		notes, err := q.ListSessionNotesVisibleToParent(ctx, store.ListSessionNotesVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: time.Time{},
		})
		if err != nil {
			return err
		}
		out.SessionNotes = []store.SessionNote{}
		for _, n := range notes {
			if n.OwnerMemberID == viewer { // notes belong to their author, like bookings
				out.SessionNotes = append(out.SessionNotes, n)
			}
		}
		if out.PlanProgress, err = q.ListPlanItemProgress(ctx, store.ListPlanItemProgressParams{
			FamilyID: familyID, MemberID: viewer,
		}); err != nil {
			return err
		}
		sort.Slice(out.PlanProgress, func(i, j int) bool {
			return out.PlanProgress[i].UpdatedAt.After(out.PlanProgress[j].UpdatedAt)
		})
		for _, e := range []string{entityMoodCheckin, entityBooking, entitySessionNote, entityExport} {
			if err := access.Audit(ctx, q, familyID, viewer, access.ActionRead, e, ""); err != nil {
				return err
			}
		}
		return nil
	})
	return out, err
}

// DeleteFamily deletes the family and, through ON DELETE CASCADE, every row
// that belongs to it: members, children, sessions, health records, check-ins,
// notes, bookings and the audit log. Nothing is kept, so there is no audit
// row for the deletion itself.
func DeleteFamily(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		return store.New(tx).DeleteFamily(ctx, familyID)
	})
}
