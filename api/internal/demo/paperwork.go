package demo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

// demoPaperworkDone is what each demo family has already ticked, so the
// checklist shows both done and open steps at its stage: the pregnant couple
// has told the employer, the newborn family has the certificate, the number and
// the employer plan but still has the Marketplace window and the passport ahead.
// A visitor's own family starts with nothing ticked.
var demoPaperworkDone = map[Template]map[string]bool{
	Pregnancy: {"leave-notice": true},
	Newborn:   {"birth-certificate": true, "ssn": true, "insurance-employer": true},
}

// seedPaperwork gives every family the US paperwork checklist for its stage.
func seedPaperwork(ctx context.Context, q *store.Queries, familyID uuid.UUID, now time.Time) error {
	fam, err := q.GetFamily(ctx, familyID)
	if err != nil {
		return err
	}
	parents, err := q.ListMembers(ctx, familyID)
	if err != nil || len(parents) == 0 {
		return err
	}
	mother, partner := parents[0].ID, parents[len(parents)-1].ID // a single parent owns every item
	return tasks.SeedPaperwork(ctx, q, familyID, mother, partner, content.PhaseOf(fam.Stage), demoPaperworkDone[Template(fam.Template)], now)
}
