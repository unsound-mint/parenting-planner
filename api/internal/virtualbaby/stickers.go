package virtualbaby

import (
	"slices"
	"time"

	"github.com/google/uuid"
)

// Stickers are earned for taking part, never for which choice someone made,
// and never from health data (BATCH decision, Nov 14). No points, ranks or
// streaks: a sticker is earned once and stays.

type StickerID string

const (
	FeedingCues   StickerID = "feeding_cues"
	FreshDiaper   StickerID = "fresh_diaper"
	BackToSleep   StickerID = "back_to_sleep"
	CalmAndSteady StickerID = "calm_and_steady"
	TagTeam       StickerID = "tag_team"
	NightOwl      StickerID = "night_owl"
	FortyEight    StickerID = "forty_eight"
)

var stickerTitles = map[StickerID]string{
	FeedingCues:   "Feeding cues",
	FreshDiaper:   "Fresh diaper",
	BackToSleep:   "Back to sleep",
	CalmAndSteady: "Calm and steady",
	TagTeam:       "Tag team",
	NightOwl:      "Night shift",
	FortyEight:    "48 hours together",
}

var needSticker = map[Need]StickerID{Hungry: FeedingCues, Wet: FreshDiaper, Sleepy: BackToSleep, Fussy: CalmAndSteady}

type Sticker struct {
	ID       StickerID
	Title    string
	EarnedAt time.Time
	EarnedBy []uuid.UUID
}

// Stickers walks the sessions oldest first and returns each sticker the first
// time it was earned, in that order.
func Stickers(sessions []Session) []Sticker {
	ordered := slices.Clone(sessions)
	slices.SortFunc(ordered, func(a, b Session) int { return a.StartedAt.Compare(b.StartedAt) })
	got := map[StickerID]bool{}
	var out []Sticker
	add := func(id StickerID, at time.Time, by ...uuid.UUID) {
		if got[id] {
			return
		}
		got[id] = true
		out = append(out, Sticker{ID: id, Title: stickerTitles[id], EarnedAt: at, EarnedBy: by})
	}
	for _, s := range ordered {
		first := uuid.Nil
		for _, m := range s.Moments {
			add(needSticker[m.Scenario.Need], m.HandledAt, m.HandledBy)
			if clock := (s.Plan.StartClock + m.Minute) % (24 * 60); clock < 5*60 {
				add(NightOwl, m.HandledAt, m.HandledBy)
			}
			if first == uuid.Nil {
				first = m.HandledBy
			} else if m.HandledBy != first {
				add(TagTeam, m.HandledAt, first, m.HandledBy)
			}
		}
		if s.Mode == Challenge && s.FinishedAt != nil && len(s.Moments) == len(s.Plan.Slots) {
			var by []uuid.UUID
			for _, m := range s.Moments {
				if !slices.Contains(by, m.HandledBy) {
					by = append(by, m.HandledBy)
				}
			}
			add(FortyEight, *s.FinishedAt, by...)
		}
	}
	// Order by when each was earned, across sessions.
	slices.SortStableFunc(out, func(a, b Sticker) int { return a.EarnedAt.Compare(b.EarnedAt) })
	if out == nil {
		out = []Sticker{}
	}
	return out
}
