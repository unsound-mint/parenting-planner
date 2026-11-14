package care

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSuggestNamesAThemeFromTwoOwnEntries(t *testing.T) {
	now := time.Date(2026, 11, 14, 21, 0, 0, 0, time.UTC)
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	e := func(id uuid.UUID, daysAgo int, body string, topic bool) ownEntry {
		return ownEntry{ID: id, WrittenAt: now.AddDate(0, 0, -daysAgo), Body: body, HasTopic: topic}
	}
	cases := []struct {
		name    string
		entries []ownEntry // newest first
		current []Topic
		want    string
		on      uuid.UUID
	}{
		{"one mention is not a pattern", []ownEntry{e(a, 1, "Woke at 3 again.", false)}, nil, "", uuid.Nil},
		{"two mentions suggest, on the newest entry without a topic",
			[]ownEntry{e(a, 1, "Woke at 3 again.", true), e(b, 2, "Could not get back to sleep.", false), e(c, 3, "Slept badly, kicks.", false)},
			nil, "Sleep lately", b},
		{"whole words only: 'network' is not work",
			[]ownEntry{e(a, 1, "The network was down.", false), e(b, 2, "Networking event.", false)}, nil, "", uuid.Nil},
		{"the theme already on the agenda is not suggested again",
			[]ownEntry{e(a, 1, "Woke at 3.", false), e(b, 2, "No sleep.", false)},
			[]Topic{{Text: "Sleep: about 5.5 hours a night lately"}}, "", uuid.Nil},
		{"more mentions win over catalog order",
			[]ownEntry{e(a, 1, "Nervous about the birth.", false), e(b, 2, "Labour scares me.", false), e(c, 3, "Hospital bag, birth plan, and I woke early.", false)},
			nil, "Feelings about the birth", a},
		{"every matching entry already has a topic: nothing to put it on",
			[]ownEntry{e(a, 1, "Woke at 3.", true), e(b, 2, "No sleep.", true)}, nil, "", uuid.Nil},
	}
	for _, tc := range cases {
		got := suggest(tc.entries, tc.current)
		switch {
		case tc.want == "" && len(got) != 0:
			t.Errorf("%s: got %+v, want none", tc.name, got)
		case tc.want != "" && (len(got) != 1 || got[0].Text != tc.want || got[0].DiaryEntryID != tc.on):
			t.Errorf("%s: got %+v, want %q on %v", tc.name, got, tc.want, tc.on)
		}
	}
}
