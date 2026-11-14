package demo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/badges"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/missions"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Missions and stickers for each demo family: a few taken, a few done with a
// one-line note, and the stickers they and the learning reads earn. Mission
// keys must belong to the template's stage (missions.StageOf).

type missionPick struct {
	key  string
	by   who
	days int // days since finished; 0 = only taken
	note string
}

var missionStories = map[Template][]missionPick{
	Pregnancy: {
		{"t2-freezer-meals", partner, 3, "Chili and lentil soup, six boxes, all labeled."},
		{"t2-bump-photo", mother, 6, "Against the kitchen door, in Jake's old hoodie."},
		{"t2-nursery-corner", partner, 0, ""},
		{"t2-babymoon", mother, 0, ""},
	},
	Planning: {
		{"plan-cook-together", partner, 4, "Mushroom risotto. A bit salty, still great."},
		{"plan-dream-list", mother, 0, ""},
		{"plan-both-checkups", partner, 0, ""},
	},
	Newborn: {
		{"nb-diaper-station", partner, 20, "One on each floor, plus the car."},
		{"nb-meal-train", partner, 5, "Pasta, tacos and a big soup."},
		{"nb-calm-plan", mother, 12, "Put him down, step out, call each other."},
		{"nb-visit-notes", partner, 0, ""},
	},
	Preschool: {
		{"td-play-hour", partner, 2, "Blocks, then a very long train."},
		{"td-new-recipe", mother, 0, ""},
	},
}

// Extra lessons finished so each demo family has a path sticker or two; they
// come on top of the learning story in learning.go (all older than its latest
// activity, so "tonight together" is unchanged).
var pathFinishes = map[Template]struct {
	path string
	who  []who
	day  int
}{
	Pregnancy: {"couple", []who{mother, partner}, -8},
	Planning:  {"couple", []who{mother}, -3},
	Newborn:   {"first-weeks", []who{mother}, -4},
}

// seedMissions writes the template's missions, finishes a path, and stores the
// stickers they earn. The newest sticker of each parent stays unseen, so the
// sticker book plays its earn animation once for a new visitor.
func seedMissions(ctx context.Context, q *store.Queries, t Template, fam, mom, dad uuid.UUID, today time.Time) error {
	id := func(w who) uuid.UUID {
		if w == mother {
			return mom
		}
		return dad
	}
	var picks []missions.SeedPick
	for _, p := range missionStories[t] {
		picks = append(picks, missions.SeedPick{Key: p.key, Owner: id(p.by), DoneDaysAgo: p.days, Note: p.note})
	}
	if err := missions.Seed(ctx, q, fam, picks, today); err != nil {
		return err
	}
	st := content.State{}
	switch t {
	case Pregnancy:
		st = content.State{Stage: "pregnancy", Week: 25, HasWeek: true}
	case Planning:
		st = content.State{Stage: "planning"}
	case Newborn:
		st = content.State{Stage: "postpartum", HasChild: true, AgeMonths: 1}
	default:
		st = content.State{Stage: "preschool", HasChild: true, AgeMonths: 48}
	}
	if f, ok := pathFinishes[t]; ok {
		for _, p := range content.LearnPathsFor(st) {
			if p.ID != f.path {
				continue
			}
			for _, w := range f.who {
				for _, l := range p.Lessons {
					at := today.AddDate(0, 0, f.day).Add(20*time.Hour + 45*time.Minute)
					if _, err := q.StartLessonRead(ctx, store.StartLessonReadParams{FamilyID: fam, MemberID: id(w), LessonID: l.ID, At: at, Finished: true}); err != nil {
						return err
					}
				}
			}
		}
	}
	// Sticker times: they were earned when the work was finished; use the day
	// before today so none is in the future for a morning visitor.
	if err := badges.Sync(ctx, q, fam, st, []uuid.UUID{mom, dad}, today.AddDate(0, 0, -1).Add(20*time.Hour)); err != nil {
		return err
	}
	rows, err := q.ListStickers(ctx, fam)
	if err != nil {
		return err
	}
	// Keep the last-earned sticker (by key order within the same time) of each parent unseen.
	last := map[uuid.UUID]string{}
	for _, r := range rows {
		last[r.MemberID] = r.Key
	}
	for _, r := range rows {
		if r.Key == last[r.MemberID] {
			continue
		}
		if _, err := q.MarkStickerSeen(ctx, store.MarkStickerSeenParams{FamilyID: fam, MemberID: r.MemberID, Key: r.Key, At: pgSeen(today)}); err != nil {
			return err
		}
	}
	return nil
}

func pgSeen(today time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: today.AddDate(0, 0, -1).Add(21 * time.Hour), Valid: true}
}
