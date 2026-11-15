package demo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// seedNightShifts is the agreed night split (demo-script step 5): the parents alternate
// nights, one takes 22:00 to 02:00 and the other 02:00 to 06:00, then they swap, so every
// night of the week is covered. Active from today, like a shift created after the baby is
// home. Times are the shift's "local time HH:MM", as the API stores them.
func seedNightShifts(ctx context.Context, q *store.Queries, fam, aisha, marcus uuid.UUID, today time.Time) error {
	odd, even := []string{"mon", "wed", "fri", "sun"}, []string{"tue", "thu", "sat"}
	for _, sh := range []struct {
		who         uuid.UUID
		title, a, b string
		days        []string
	}{
		{aisha, "Night shift: first half", "22:00", "02:00", odd},
		{aisha, "Night shift: second half", "02:00", "06:00", even},
		{marcus, "Night shift: first half", "22:00", "02:00", even},
		{marcus, "Night shift: second half", "02:00", "06:00", odd},
	} {
		if _, err := q.CreateShift(ctx, store.CreateShiftParams{
			FamilyID: fam, MemberID: sh.who, Title: sh.title, Days: sh.days, StartTime: sh.a, EndTime: sh.b,
			Status: "active", StartsOn: &today,
		}); err != nil {
			return err
		}
	}
	return nil
}
