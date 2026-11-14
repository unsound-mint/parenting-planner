package httpapi_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestNudgeDismissalStaysClosedForThatParent(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var card httpapi.Together
	c.Get(memberPath(mom.Id)+"/together", http.StatusOK, &card)
	if card.Nudge == nil || card.Nudge.Id == "" {
		t.Fatalf("want a nudge with an id, got %+v", card.Nudge)
	}
	c.Post(memberPath(mom.Id)+"/nudge-dismissals", map[string]any{"id": ""}, http.StatusBadRequest, nil)
	c.Post(memberPath(mom.Id)+"/nudge-dismissals", map[string]any{"id": card.Nudge.Id}, http.StatusNoContent, nil)
	c.Post(memberPath(mom.Id)+"/nudge-dismissals", map[string]any{"id": card.Nudge.Id}, http.StatusNoContent, nil)
	card = httpapi.Together{}
	c.Get(memberPath(mom.Id)+"/together", http.StatusOK, &card)
	if card.Nudge != nil {
		t.Errorf("a closed nudge came back, and an older one must not replace it: %+v", card.Nudge)
	}
	// Closing is per parent: the partner's own nudge is untouched.
	c.Get(memberPath(dad.Id)+"/together", http.StatusOK, &card)
	if card.Nudge == nil {
		t.Error("the partner's nudge must stay")
	}
}

func TestDiaryEntryEditAndDelete(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var e httpapi.DiaryEntry
	c.Post(diaryPath(mom), entry("first draft", "partner"), http.StatusCreated, &e)
	path := diaryPath(mom) + "/" + e.Id.String()

	c.Patch(path, map[string]any{"visibility": "partner", "body": "   "}, http.StatusBadRequest, nil)
	c.Patch(path, map[string]any{"visibility": "partner", "mood": 7}, http.StatusBadRequest, nil)
	var got httpapi.DiaryEntry
	c.Patch(path, map[string]any{"visibility": "partner", "body": " better words ", "mood": 4}, http.StatusOK, &got)
	if got.Body != "better words" || got.Mood == nil || *got.Mood != 4 || got.Visibility != httpapi.VisibilityPartner {
		t.Errorf("edited entry = %+v", got)
	}
	if _, ok := diaryBodies(c, dad)["better words"]; !ok {
		t.Error("the partner must read the edited text of a shared entry")
	}
	// Only the author edits or deletes.
	c.Patch(diaryPath(dad)+"/"+e.Id.String(), map[string]any{"visibility": "partner", "body": "x"}, http.StatusNotFound, nil)
	c.Delete(diaryPath(dad)+"/"+e.Id.String(), http.StatusNotFound, nil)

	c.Delete(path, http.StatusNoContent, nil)
	c.Delete(path, http.StatusNotFound, nil)
	if _, ok := diaryBodies(c, mom)["better words"]; ok {
		t.Error("a deleted entry is still listed")
	}
	if n := c.AuditCount(fam.Id, "delete", "diary_entry"); n != 1 {
		t.Errorf("delete audit rows = %d, want 1", n)
	}
}

func briefPath(m httpapi.Parent) string { return careBase(m) + "/session-brief" }

func briefInput(status httpapi.SessionBriefStatus, mood bool, ids ...uuid.UUID) httpapi.SessionBriefInput {
	if ids == nil {
		ids = []uuid.UUID{}
	}
	return httpapi.SessionBriefInput{Status: status, IncludeMood: mood, SharedEntryIds: ids}
}

func TestSessionBriefIsPrivateUntilSent(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var b httpapi.SessionBrief
	c.Get(briefPath(mom), http.StatusOK, &b)
	if b.Status != httpapi.Draft || b.IncludeMood || len(b.SharedEntryIds) != 0 || b.Mood == nil {
		t.Fatalf("empty brief = %+v", b)
	}

	// An entry on the agenda; its text goes only when picked.
	topic := "Birth fears"
	var e httpapi.DiaryEntry
	c.Post(diaryPath(mom), map[string]any{"body": "I keep thinking about the birth.", "visibility": "private", "agendaTopic": topic}, http.StatusCreated, &e)
	var other httpapi.DiaryEntry
	c.Post(diaryPath(mom), entry("not on the agenda", "private"), http.StatusCreated, &other)
	c.Put(briefPath(mom), briefInput(httpapi.Draft, false, other.Id), http.StatusBadRequest, nil)

	c.Get(briefPath(mom), http.StatusOK, &b)
	for _, it := range b.Items {
		if it.EntryText != nil {
			t.Errorf("entry text must not be in the brief before it is picked: %+v", it)
		}
	}

	// Scheduling needs a booked session.
	c.Put(briefPath(mom), briefInput(httpapi.Scheduled, true, e.Id), http.StatusConflict, nil)
	var slots httpapi.PsychologistSlots
	c.Get(careBase(mom)+"/psychologist-slots", http.StatusOK, &slots)
	var later httpapi.Slot
	for _, s := range slots.Items {
		if s.StartsAt.Sub(testutil.Now) > 3*24*time.Hour {
			later = s
			break
		}
	}
	var booking httpapi.PsychologistBooking
	c.Post(careBase(mom)+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: later.Id}, http.StatusCreated, &booking)

	note := "Short on time, start with the first topic."
	in := briefInput(httpapi.Scheduled, true, e.Id)
	in.Note = &note
	c.Put(briefPath(mom), in, http.StatusOK, &b)
	if b.Status != httpapi.Scheduled || b.SendAt == nil || !b.SendAt.Equal(booking.StartsAt.Add(-24*time.Hour)) || b.Session == nil || b.Session.Id != booking.Id {
		t.Fatalf("scheduled brief = %+v", b)
	}
	var shared bool
	for _, it := range b.Items {
		shared = shared || (it.Text == topic && it.EntryText != nil && *it.EntryText == e.Body)
	}
	if !shared || b.Mood == nil || b.Note == nil || *b.Note != note {
		t.Errorf("scheduled brief must carry the picked entry, the mood summary and the note: %+v", b)
	}

	// Frozen: a new topic after scheduling is not in the brief.
	c.Post(diaryPath(mom), map[string]any{"body": "later", "visibility": "private", "agendaTopic": "Later topic"}, http.StatusCreated, nil)
	c.Get(briefPath(mom), http.StatusOK, &b)
	for _, it := range b.Items {
		if it.Text == "Later topic" {
			t.Error("a scheduled brief must not change")
		}
	}

	// The partner has their own, empty brief and never the mother's.
	var seen httpapi.SessionBrief
	c.Get(briefPath(dad), http.StatusOK, &seen)
	if seen.Session != nil || len(seen.SharedEntryIds) != 0 || seen.Note != nil {
		t.Errorf("partner sees %+v", seen)
	}
	for _, it := range seen.Items {
		if strings.Contains(it.Text, topic) {
			t.Errorf("partner sees the mother's topic %q", it.Text)
		}
	}
	c.Put(briefPath(dad), briefInput(httpapi.Draft, false, e.Id), http.StatusBadRequest, nil)

	// Moving the session moves the send time; cancelling it brings the draft back.
	var moved httpapi.PsychologistBooking
	var next httpapi.Slot
	for _, s := range slots.Items {
		if s.StartsAt.After(later.StartsAt) {
			next = s
			break
		}
	}
	c.Patch(careBase(mom)+"/psychologist-bookings/"+booking.Id.String(), httpapi.PsychologistBookingInput{SlotId: next.Id}, http.StatusOK, &moved)
	b = httpapi.SessionBrief{}
	c.Get(briefPath(mom), http.StatusOK, &b)
	if !moved.StartsAt.Equal(next.StartsAt) || b.SendAt == nil || !b.SendAt.Equal(next.StartsAt.Add(-24*time.Hour)) {
		t.Errorf("after the move: booking %+v, brief send at %v", moved, b.SendAt)
	}
	c.Delete(careBase(dad)+"/psychologist-bookings/"+booking.Id.String(), http.StatusNotFound, nil)
	c.Delete(careBase(mom)+"/psychologist-bookings/"+booking.Id.String(), http.StatusNoContent, nil)
	b = httpapi.SessionBrief{}
	c.Get(briefPath(mom), http.StatusOK, &b)
	if b.Status != httpapi.Draft || b.Session != nil || b.SendAt != nil || len(b.SharedEntryIds) != 1 || b.Note == nil {
		t.Errorf("after cancelling, the brief is a draft with the choices kept: %+v", b)
	}

	// Sent by hand: needs a session, then frozen for good.
	c.Put(briefPath(mom), briefInput(httpapi.Sent, false), http.StatusConflict, nil)
	c.Post(careBase(mom)+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: later.Id}, http.StatusCreated, nil)
	b = httpapi.SessionBrief{}
	c.Put(briefPath(mom), briefInput(httpapi.Sent, false), http.StatusOK, &b)
	if b.Status != httpapi.Sent || b.SentAt == nil {
		t.Errorf("sent brief = %+v", b)
	}
	c.Put(briefPath(mom), briefInput(httpapi.Draft, false), http.StatusConflict, nil)
	if n := c.AuditCount(fam.Id, "update", "session_brief"); n < 1 {
		t.Error("brief changes must be audited")
	}
}

func TestScheduledBriefCountsAsSentTheDayBefore(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var slots httpapi.PsychologistSlots
	c.Get(careBase(mom)+"/psychologist-slots", http.StatusOK, &slots)
	// A session less than a day away: scheduling sends it now.
	soon := slots.Items[0]
	if soon.StartsAt.Sub(testutil.Now) >= 24*time.Hour {
		t.Skip("no slot within a day of the test clock")
	}
	c.Post(careBase(mom)+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: soon.Id}, http.StatusCreated, nil)
	var b httpapi.SessionBrief
	c.Put(briefPath(mom), briefInput(httpapi.Scheduled, false), http.StatusOK, &b)
	if b.Status != httpapi.Sent || b.SentAt == nil {
		t.Errorf("a brief scheduled under a day before the session goes now: %+v", b)
	}
}
