package thanks

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func TestSuggestNamesTheSpecificThing(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC) // a Saturday
	me, jake, gran := uuid.New(), uuid.New(), uuid.New()
	people := []store.Member{
		{ID: me, Role: "mother", DisplayName: "Emily"},
		{ID: jake, Role: "partner", DisplayName: "Jake"},
		{ID: gran, Role: "grandparent", DisplayName: "Linda"},
	}
	at := func(daysAgo, h int) time.Time {
		return now.AddDate(0, 0, -daysAgo).Truncate(24 * time.Hour).Add(time.Duration(h) * time.Hour)
	}
	feed := func(who uuid.UUID, ts time.Time) store.CareLogEntry {
		return store.CareLogEntry{Kind: "feed", AuthorMemberID: who, StartedAt: ts}
	}
	done := func(kind string, by uuid.UUID, days int) store.Task {
		return store.Task{Kind: kind, Title: "Order the crib", Done: true, DoneAt: pgtype.Timestamptz{Time: at(days, 18), Valid: true}, DoneByMemberID: uuid.NullUUID{UUID: by, Valid: true}}
	}
	in := Input{Now: now, Actor: me, People: people, Sent: map[string]bool{},
		Care: []store.CareLogEntry{
			// Tuesday night (Nov 10) into Wednesday: both feeds belong to the night that started Tuesday.
			feed(jake, at(4, 23)), feed(jake, at(3, 2)),
			feed(gran, at(1, 15)),
			feed(me, at(1, 9)), // the actor's own work is never thanked
		},
		Tasks: []store.Task{done("hospital_bag", jake, 1), done("hospital_bag", jake, 2), done("task", jake, 3), done("task", me, 3)},
	}
	got := map[string]Suggestion{}
	for _, s := range Suggest(in) {
		got[s.Basis] = s
	}
	if s := got["night_feeds"]; s.Text != "Thank you for the 2 night feeds on Tuesday." || s.Count != 2 || s.ToMember != jake {
		t.Errorf("night feeds = %+v", s)
	}
	if s := got["bag_items"]; s.Text != "Thank you for packing 2 bag items." {
		t.Errorf("bag items = %+v", s)
	}
	if s := got["tasks_done"]; !strings.Contains(s.Text, "Order the crib") || s.Count != 1 {
		t.Errorf("tasks = %+v", s)
	}
	if s := got["caregiver_care"]; s.Text != "Thank you, Linda, for the feed on Friday." || s.ToMember != gran {
		t.Errorf("caregiver = %+v", s)
	}
	for _, s := range Suggest(in) {
		if s.ToMember == me {
			t.Errorf("suggested thanking oneself: %+v", s)
		}
	}

	// A thanked key is not offered again; the others stay.
	in.Sent[got["night_feeds"].Key] = true
	for _, s := range Suggest(in) {
		if s.Basis == "night_feeds" {
			t.Error("night feeds were thanked already")
		}
	}
}

func TestSuggestCaregiverShiftAndOldWork(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	me, nanny := uuid.New(), uuid.New()
	people := []store.Member{{ID: me, Role: "mother"}, {ID: nanny, Role: "nanny", DisplayName: "Maria"}}
	start := now.AddDate(0, 0, -30)
	in := Input{Now: now, Actor: me, People: people, Sent: map[string]bool{},
		Shifts: []store.Shift{{MemberID: nanny, Status: "active", Title: "Nap shift", Days: []string{"tue"}, StartsOn: &start}},
		Care:   []store.CareLogEntry{{Kind: "feed", AuthorMemberID: nanny, StartedAt: now.AddDate(0, 0, -20)}},
	}
	got := Suggest(in)
	if len(got) != 1 || got[0].Text != "Thank you, Maria, for Tuesday’s nap shift." {
		t.Fatalf("suggestions = %+v", got)
	}
	if got := Suggest(Input{Now: now, Actor: me, People: people}); len(got) != 0 {
		t.Errorf("nothing happened: %+v", got)
	}
}
