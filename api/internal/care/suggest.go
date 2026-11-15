package care

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// suggestWindow is how far back suggestions look at the parent's own entries.
const suggestWindow = 7 * 24 * time.Hour

// minMentions entries on one theme make a suggestion.
const minMentions = 2

// Suggestion is a topic the parent might add from their own journal. It names
// a theme, never the entry text, and goes on DiaryEntryID when taken.
type Suggestion struct {
	Text         string
	Reason       string
	DiaryEntryID uuid.UUID
}

// theme is a subject a parent may want to raise with a psychologist. The words
// only spot the subject; the topic text is fixed here and describes it, never
// assesses it.
type theme struct {
	about string // "You wrote about <about> in 2 entries this week."
	text  string // the topic
	words []string
}

// Catalog order breaks ties: sleep first, it is the commonest thread.
var themes = []theme{
	{"sleep", "Sleep lately", []string{"sleep", "sleeping", "slept", "sleepless", "asleep", "awake", "woke", "waking", "insomnia", "nap", "naps", "tired", "exhausted"}},
	{"the birth", "Feelings about the birth", []string{"birth", "labour", "labor", "contractions", "delivery", "hospital", "epidural", "caesarean", "cesarean"}},
	{"worry", "Worry and nerves", []string{"anxious", "worried", "worry", "worrying", "nervous", "scared", "afraid", "panic", "dread"}},
	{"feeding", "Feeding", []string{"feed", "feeding", "feeds", "breastfeeding", "bottle", "latch", "formula"}},
	{"the two of you", "How we are as a couple", []string{"argue", "argued", "argument", "fight", "fought", "distant", "snapped"}},
	{"feeling alone", "Feeling alone", []string{"alone", "lonely", "isolated"}},
	{"work", "Work and leave", []string{"work", "job", "boss", "office", "deadline"}},
	{"money", "Money worries", []string{"money", "bills", "afford", "rent", "expensive"}},
}

// ownEntry is what suggest needs from one of the parent's own entries.
type ownEntry struct {
	ID        uuid.UUID
	WrittenAt time.Time
	Body      string
	HasTopic  bool
}

// suggestions reads the parent's own entries of the last week and returns at
// most one suggestion. Only the viewer's own entries count, whatever their
// visibility: an entry the other parent shared is theirs, not a topic here.
func suggestions(ctx context.Context, q *store.Queries, key crypt.Key, familyID, viewer uuid.UUID, now time.Time, current []Topic) ([]Suggestion, error) {
	// The newest 100 cover a week of journaling; older rows are dropped below.
	rows, err := q.ListDiaryEntriesVisibleToParent(ctx, store.ListDiaryEntriesVisibleToParentParams{
		FamilyID: familyID, ViewerID: viewer, Before: now.AddDate(100, 0, 0), PageSize: 100,
	})
	if err != nil {
		return nil, err
	}
	since := now.Add(-suggestWindow)
	var own []ownEntry
	for _, r := range rows {
		if r.OwnerMemberID != viewer || r.WrittenAt.Before(since) {
			continue
		}
		body, err := key.Open(r.BodySealed)
		if errors.Is(err, crypt.ErrCannotDecrypt) {
			continue // sealed with an earlier key, as in diary.List
		}
		if err != nil {
			return nil, err
		}
		own = append(own, ownEntry{ID: r.ID, WrittenAt: r.WrittenAt, Body: body, HasTopic: r.AgendaTopic != nil})
	}
	return suggest(own, current), nil
}

// suggest is the pure part: entries newest first, the current agenda topics.
func suggest(entries []ownEntry, current []Topic) []Suggestion {
	// A theme is already covered when a topic names it: "Sleep lately" taken from
	// the journal, or "Sleep: about 5.5 hours a night" from the check-ins.
	covered := func(th theme) bool {
		for _, t := range current {
			if l := strings.ToLower(t.Text); l == strings.ToLower(th.text) || strings.Contains(l, th.about) {
				return true
			}
		}
		return false
	}
	words := make([]map[string]bool, len(entries))
	for i, e := range entries {
		words[i] = map[string]bool{}
		for _, w := range strings.FieldsFunc(strings.ToLower(e.Body), func(r rune) bool { return !unicode.IsLetter(r) && r != '\'' }) {
			words[i][strings.Trim(w, "'")] = true
		}
	}
	var best *Suggestion
	bestN := 0
	for _, th := range themes {
		if covered(th) {
			continue
		}
		n := 0
		target := uuid.Nil
		for i, e := range entries {
			if !mentions(words[i], th.words) {
				continue
			}
			n++
			if target == uuid.Nil && !e.HasTopic {
				target = e.ID // entries are newest first
			}
		}
		if n >= minMentions && n > bestN && target != uuid.Nil {
			bestN = n
			best = &Suggestion{Text: th.text, Reason: fmt.Sprintf("You wrote about %s in %d entries this week.", th.about, n), DiaryEntryID: target}
		}
	}
	if best == nil {
		return nil
	}
	return []Suggestion{*best}
}

func mentions(have map[string]bool, words []string) bool {
	for _, w := range words {
		if have[w] {
			return true
		}
	}
	return false
}
