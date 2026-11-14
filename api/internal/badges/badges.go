// Package badges is the sticker book: small illustrated stickers a parent earns
// for finishing lessons and paths, finishing missions and practising with the
// virtual baby. There are no points, ranks, streaks or leaderboards, and no
// sticker is ever awarded for health data (mood, weight, symptoms): stickers
// read only learning reads, mission tasks and explicit Award calls.
//
// Stickers are computed from database state by Sync and stored once, so each
// is earned exactly once per parent. seen_at is null until the web app has
// played the peel-and-stick animation, which makes the celebration play once.
//
// The virtual baby calls Award (see its doc) when practice is finished.
package badges

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/missions"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrUnknownSticker = errors.New("unknown sticker")
	ErrNotAwardable   = errors.New("this sticker is earned by reading or missions, not awarded")
)

// Groups of stickers, in the order the book shows them.
const (
	GroupLearning = "learning"
	GroupTogether = "together"
	GroupMissions = "missions"
	GroupPractice = "practice"
)

// Keys the virtual baby may award.
const (
	BabyFirstPractice = "baby_first_practice"
	Baby48h           = "baby_48h"
)

const (
	FirstLesson    = "first_lesson"
	FirstMission   = "mission_first"
	BothMissions   = "mission_both"
	pathPrefix     = "path_"
	togetherPrefix = "together_"
	missionPrefix  = "mission_"
)

// Def is one sticker in the catalogue. Art names the web illustration.
type Def struct {
	Key, Title, Blurb, Art, Group string
	// PathID is set for stickers that belong to a learning path.
	PathID string
}

var catalog = buildCatalog()

func buildCatalog() []Def {
	out := []Def{{Key: FirstLesson, Title: "Page one", Blurb: "Finished a first lesson.", Art: "book", Group: GroupLearning}}
	paths := content.AllLearnPaths()
	for _, p := range paths {
		out = append(out, Def{Key: pathPrefix + p.ID, Title: p.Title, Blurb: "Read every lesson in " + p.Title + ".", Art: pathPrefix + p.ID, Group: GroupLearning, PathID: p.ID})
	}
	for _, p := range paths {
		out = append(out, Def{Key: togetherPrefix + p.ID, Title: p.Title + ", together", Blurb: "You both finished " + p.Title + ".", Art: togetherPrefix + p.ID, Group: GroupTogether, PathID: p.ID})
	}
	out = append(out,
		Def{Key: FirstMission, Title: "First mission", Blurb: "Finished a first mission.", Art: "mission_first", Group: GroupMissions},
		Def{Key: BothMissions, Title: "Side by side", Blurb: "You each finished a mission.", Art: "mission_both", Group: GroupMissions},
	)
	for _, c := range []struct{ id, title, blurb string }{
		{missions.Meals, "Kitchen helper", "Finished a meals mission."},
		{missions.Home, "Nest builder", "Finished a home mission."},
		{missions.Gear, "Gear ready", "Finished a gear mission."},
		{missions.Care, "Care champion", "Finished a care mission."},
		{missions.Learning, "Quick study", "Finished a learning mission."},
		{missions.Rest, "Night owl", "Finished a rest mission."},
		{missions.Together, "Closer", "Finished a together mission."},
	} {
		out = append(out, Def{Key: missionPrefix + c.id, Title: c.title, Blurb: c.blurb, Art: missionPrefix + c.id, Group: GroupMissions})
	}
	out = append(out,
		Def{Key: BabyFirstPractice, Title: "Practice parent", Blurb: "Tried the virtual baby.", Art: BabyFirstPractice, Group: GroupPractice},
		Def{Key: Baby48h, Title: "The 48 hours", Blurb: "Finished the 48-hour challenge.", Art: Baby48h, Group: GroupPractice},
	)
	return out
}

// Catalog returns every sticker the book can hold.
func Catalog() []Def { return slices.Clone(catalog) }

func find(key string) (Def, bool) {
	for _, d := range catalog {
		if d.Key == key {
			return d, true
		}
	}
	return Def{}, false
}

// Award gives a parent a practice sticker (BabyFirstPractice or Baby48h) once.
// The virtual baby calls it in the transaction that records the practice, with
// the practising parent's id. It returns true when the sticker is new. Safe to
// call repeatedly. Keys other than the practice stickers are earned by Sync and
// are refused with ErrNotAwardable.
func Award(ctx context.Context, q *store.Queries, familyID, memberID uuid.UUID, key string, now time.Time) (bool, error) {
	d, ok := find(key)
	switch {
	case !ok:
		return false, ErrUnknownSticker
	case d.Group != GroupPractice:
		return false, ErrNotAwardable
	}
	_, err := q.CreateSticker(ctx, store.CreateStickerParams{FamilyID: familyID, MemberID: memberID, Key: key, EarnedAt: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// Sync stores every sticker the family's current state earns. parents are the
// family's parents; together stickers need exactly two.
func Sync(ctx context.Context, q *store.Queries, familyID uuid.UUID, st content.State, parents []uuid.UUID, now time.Time) error {
	earned := map[uuid.UUID]map[string]bool{}
	give := func(m uuid.UUID, key string) {
		if earned[m] == nil {
			earned[m] = map[string]bool{}
		}
		earned[m][key] = true
	}

	reads, err := q.ListLessonReads(ctx, familyID)
	if err != nil {
		return err
	}
	finished := map[uuid.UUID]map[string]bool{}
	for _, r := range reads {
		if !r.FinishedAt.Valid {
			continue
		}
		if finished[r.MemberID] == nil {
			finished[r.MemberID] = map[string]bool{}
		}
		finished[r.MemberID][r.LessonID] = true
		give(r.MemberID, FirstLesson)
	}
	for _, p := range content.LearnPathsFor(st) {
		var all []uuid.UUID
		for _, m := range parents {
			done := len(p.Lessons) > 0
			for _, l := range p.Lessons {
				done = done && finished[m][l.ID]
			}
			if done {
				give(m, pathPrefix+p.ID)
				all = append(all, m)
			}
		}
		if len(parents) == 2 && len(all) == 2 {
			for _, m := range all {
				give(m, togetherPrefix+p.ID)
			}
		}
	}

	picks, err := q.ListMissionPicks(ctx, familyID)
	if err != nil {
		return err
	}
	rows, err := q.ListTasks(ctx, store.ListTasksParams{FamilyID: familyID})
	if err != nil {
		return err
	}
	taskByID := map[uuid.UUID]store.Task{}
	for _, t := range rows {
		taskByID[t.ID] = t
	}
	doers := map[uuid.UUID]bool{}
	for _, pk := range picks {
		if !pk.TaskID.Valid {
			continue
		}
		t, ok := taskByID[pk.TaskID.UUID]
		m, known := missions.ByKey(pk.MissionKey)
		if !ok || !t.Done || !known {
			continue
		}
		doer := t.AssigneeMemberID
		if t.DoneByMemberID.Valid {
			doer = t.DoneByMemberID.UUID
		}
		doers[doer] = true
		give(doer, FirstMission)
		give(doer, missionPrefix+m.Category)
	}
	if len(parents) == 2 && doers[parents[0]] && doers[parents[1]] {
		give(parents[0], BothMissions)
		give(parents[1], BothMissions)
	}

	for _, m := range parents {
		for _, d := range catalog {
			if earned[m][d.Key] {
				if _, err := q.CreateSticker(ctx, store.CreateStickerParams{FamilyID: familyID, MemberID: m, Key: d.Key, EarnedAt: now}); err != nil && !errors.Is(err, pgx.ErrNoRows) {
					return err
				}
			}
		}
	}
	return nil
}

// Sticker is one slot of a parent's book.
type Sticker struct {
	Def
	Earned   bool
	EarnedAt *time.Time
	// New is true while the earn animation has not played yet.
	New bool
}

// Book is a parent's sticker book for the family's stage: every sticker they
// have earned, plus the open slots of the paths offered now and the other
// groups. It syncs first, so reads and finished missions show up at once.
func Book(ctx context.Context, pool *pgxpool.Pool, familyID, member uuid.UUID, st content.State, parents []uuid.UUID, now time.Time) ([]Sticker, error) {
	var out []Sticker
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := Sync(ctx, q, familyID, st, parents, now); err != nil {
			return err
		}
		rows, err := q.ListStickers(ctx, familyID)
		if err != nil {
			return err
		}
		mine := map[string]store.Sticker{}
		for _, r := range rows {
			if r.MemberID == member {
				mine[r.Key] = r
			}
		}
		offered := map[string]bool{}
		for _, p := range content.LearnPathsFor(st) {
			offered[p.ID] = true
		}
		out = make([]Sticker, 0, len(catalog))
		for _, d := range catalog {
			r, has := mine[d.Key]
			if !has && d.PathID != "" && !offered[d.PathID] {
				continue
			}
			s := Sticker{Def: d, Earned: has}
			if has {
				at := r.EarnedAt
				s.EarnedAt, s.New = &at, !r.SeenAt.Valid
			}
			out = append(out, s)
		}
		return nil
	})
	return out, err
}

// MarkSeen records that the earn animation played for the parent's sticker.
func MarkSeen(ctx context.Context, pool *pgxpool.Pool, familyID, member uuid.UUID, key string, now time.Time) error {
	_, err := store.New(pool).MarkStickerSeen(ctx, store.MarkStickerSeenParams{
		FamilyID: familyID, MemberID: member, Key: key, At: pgtype.Timestamptz{Time: now, Valid: true},
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrUnknownSticker
	}
	return err
}
