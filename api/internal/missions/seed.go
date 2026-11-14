package missions

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// SeedPick is a mission a demo family has taken. DoneDaysAgo above 0 means the
// owner finished it that many days ago, with Note.
type SeedPick struct {
	Key         string
	Owner       uuid.UUID
	DoneDaysAgo int
	Note        string
}

// Seed takes (and finishes) missions for a demo family, through the same rows
// Take and Done write.
func Seed(ctx context.Context, q *store.Queries, familyID uuid.UUID, picks []SeedPick, today time.Time) error {
	for _, p := range picks {
		m, ok := ByKey(p.Key)
		if !ok {
			return ErrUnknown
		}
		params := store.CreateTaskParams{
			FamilyID: familyID, Kind: "task", Title: m.Title, Detail: &m.Why,
			AssigneeMemberID: p.Owner, CreatedByMemberID: p.Owner,
		}
		if m.DueDays > 0 {
			due := today.AddDate(0, 0, m.DueDays)
			params.DueOn = &due
		}
		if m.Source != nil {
			checked := m.Source.CheckedAt
			params.SourceTitle, params.SourceUrl, params.SourceCheckedOn = &m.Source.Title, &m.Source.URL, &checked
		}
		t, err := q.CreateTask(ctx, params)
		if err != nil {
			return err
		}
		if _, err := q.TakeMissionPick(ctx, store.TakeMissionPickParams{FamilyID: familyID, MissionKey: p.Key, TaskID: uuid.NullUUID{UUID: t.ID, Valid: true}}); err != nil {
			return err
		}
		if p.DoneDaysAgo == 0 {
			continue
		}
		at := today.AddDate(0, 0, -p.DoneDaysAgo).Add(18 * time.Hour)
		if _, err := q.SetTaskDone(ctx, store.SetTaskDoneParams{
			ID: t.ID, FamilyID: familyID, Done: true,
			DoneAt: pgtype.Timestamptz{Time: at, Valid: true}, DoneByMemberID: uuid.NullUUID{UUID: p.Owner, Valid: true},
		}); err != nil {
			return err
		}
		if p.Note != "" {
			if err := q.SetMissionNote(ctx, store.SetMissionNoteParams{FamilyID: familyID, MissionKey: p.Key, Note: &p.Note}); err != nil {
				return err
			}
		}
	}
	return nil
}
