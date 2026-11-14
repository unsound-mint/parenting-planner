package httpapi_test

// The psychologist flow, tested like wellbeing_test.go: validation, privacy
// between parents, audit, and the effect of a session note on the plan.

import (
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func careBase(p httpapi.Parent) string { return "/api/members/" + p.Id.String() }

func TestCareValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	base := careBase(mom)
	var agenda httpapi.PsychologistAgenda
	c.Get(base+"/psychologist-agenda", http.StatusOK, &agenda)
	id := agenda.NoteDue.Id.String()

	c.Post(base+"/psychologist-bookings", map[string]any{"slotId": "not-a-uuid"}, http.StatusBadRequest, nil)
	c.Post(base+"/psychologist-bookings", map[string]any{}, http.StatusBadRequest, nil)
	c.Post(base+"/session-notes", map[string]any{"bookingId": id}, http.StatusBadRequest, nil)
	c.Post(base+"/session-notes", map[string]any{"bookingId": id, "text": ""}, http.StatusBadRequest, nil)
	c.Post(base+"/session-notes", map[string]any{"bookingId": id, "text": "   "}, http.StatusBadRequest, nil)
	c.Post(base+"/session-notes", map[string]any{"bookingId": id, "text": strings.Repeat("a", 1001)}, http.StatusBadRequest, nil)
}

func TestPsychologistBooking(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var slots httpapi.PsychologistSlots
	c.Get(careBase(mom)+"/psychologist-slots", http.StatusOK, &slots)
	if len(slots.Items) == 0 || slots.Provider.Name == "" {
		t.Fatalf("want open slots with a provider, got %+v", slots)
	}
	for i, s := range slots.Items {
		if !s.StartsAt.After(testutil.Now) || s.StartsAt.After(testutil.Now.AddDate(0, 0, 14)) {
			t.Errorf("slot %s is outside the next 14 days", s.StartsAt)
		}
		if i > 0 && s.StartsAt.Before(slots.Items[i-1].StartsAt) {
			t.Error("slots must be earliest first")
		}
	}
	first := slots.Items[0]

	var b httpapi.PsychologistBooking
	c.Post(careBase(mom)+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: first.Id}, http.StatusCreated, &b)
	if !b.StartsAt.Equal(first.StartsAt) || b.NoteWritten || b.Provider.Id != slots.Provider.Id {
		t.Errorf("booking = %+v, want slot %+v", b, first)
	}
	c.Post(careBase(mom)+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: first.Id}, http.StatusConflict, nil)
	c.Post(careBase(mom)+"/psychologist-bookings", map[string]any{"slotId": "00000000-0000-0000-0000-000000000001"}, http.StatusConflict, nil)

	var after httpapi.PsychologistSlots
	c.Get(careBase(mom)+"/psychologist-slots", http.StatusOK, &after)
	if len(after.Items) != len(slots.Items)-1 || after.Items[0].Id == first.Id {
		t.Error("the booked slot must leave the mother's open slots")
	}
	var agenda httpapi.PsychologistAgenda
	c.Get(careBase(mom)+"/psychologist-agenda", http.StatusOK, &agenda)
	if agenda.NextSession == nil || agenda.NextSession.Id != b.Id {
		t.Errorf("next session = %+v, want the new booking", agenda.NextSession)
	}

	// Availability is per parent: the partner still sees and can book the slot.
	var partnerSlots httpapi.PsychologistSlots
	c.Get(careBase(partner)+"/psychologist-slots", http.StatusOK, &partnerSlots)
	if len(partnerSlots.Items) != len(slots.Items) {
		t.Errorf("partner sees %d slots, want %d: the mother's booking must not show", len(partnerSlots.Items), len(slots.Items))
	}
	c.Post(careBase(partner)+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: first.Id}, http.StatusCreated, nil)
}

func TestPsychologistAgendaPrivacy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var slots httpapi.PsychologistSlots
	c.Get(careBase(mom)+"/psychologist-slots", http.StatusOK, &slots)
	c.Post(careBase(mom)+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: slots.Items[0].Id}, http.StatusCreated, nil)
	secret := "worried about the birth"
	for range 2 {
		c.Post(careBase(mom)+"/mood-checkins", httpapi.MoodCheckinInput{Mood: 1, Energy: 1, SleepHours: 5, Note: &secret, Visibility: httpapi.VisibilityPrivate}, http.StatusCreated, nil)
	}
	var own httpapi.PsychologistAgenda
	c.Get(careBase(mom)+"/psychologist-agenda", http.StatusOK, &own)
	if own.NextSession == nil || own.NoteDue == nil {
		t.Errorf("mother must see her next session and the note due, got %+v", own)
	}
	var lowTopic bool
	for _, tp := range own.Topics {
		if strings.Contains(tp.Text, secret) {
			t.Errorf("topic %q contains private check-in text", tp.Text)
		}
		lowTopic = lowTopic || strings.Contains(tp.Text, "low days")
	}
	if !lowTopic {
		t.Errorf("mother's own low days must be a topic, got %+v", own.Topics)
	}
	// The partner's own low check-ins, shared with the mother, are his topics, not hers.
	for range 2 {
		c.Post(careBase(partner)+"/mood-checkins", checkin(1, httpapi.VisibilityFamily), http.StatusCreated, nil)
	}
	var again httpapi.PsychologistAgenda
	c.Get(careBase(mom)+"/psychologist-agenda", http.StatusOK, &again)
	if !reflect.DeepEqual(own.Topics, again.Topics) {
		t.Errorf("the partner's shared check-ins changed the mother's topics: %+v -> %+v", own.Topics, again.Topics)
	}

	var seen httpapi.PsychologistAgenda
	c.Get(careBase(partner)+"/psychologist-agenda", http.StatusOK, &seen)
	if seen.NextSession != nil || seen.NoteDue != nil {
		t.Errorf("partner must not see the mother's sessions, got %+v", seen)
	}
	for _, tp := range seen.Topics {
		if strings.Contains(tp.Text, secret) {
			t.Errorf("partner topic %q leaks the mother's text", tp.Text)
		}
	}
	// The partner cannot write a note on the mother's session.
	c.Post(careBase(partner)+"/session-notes", httpapi.SessionNoteInput{BookingId: own.NoteDue.Id, Text: "x"}, http.StatusNotFound, nil)
}

func TestSessionNote(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	base := careBase(mom)

	var agenda httpapi.PsychologistAgenda
	c.Get(base+"/psychologist-agenda", http.StatusOK, &agenda)
	if agenda.NoteDue == nil || !agenda.NoteDue.StartsAt.Before(testutil.Now) {
		t.Fatalf("demo mother must have a past session that needs a note, got %+v", agenda.NoteDue)
	}
	var slots httpapi.PsychologistSlots
	c.Get(base+"/psychologist-slots", http.StatusOK, &slots)
	var future httpapi.PsychologistBooking
	c.Post(base+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: slots.Items[0].Id}, http.StatusCreated, &future)
	c.Post(base+"/session-notes", httpapi.SessionNoteInput{BookingId: future.Id, Text: "not yet"}, http.StatusBadRequest, nil)
	c.Post(base+"/session-notes", httpapi.SessionNoteInput{BookingId: slots.Items[0].Id, Text: "no such booking"}, http.StatusNotFound, nil)

	text := "Breathing exercise helped; try it before bed."
	var n httpapi.SessionNote
	c.Post(base+"/session-notes", httpapi.SessionNoteInput{BookingId: agenda.NoteDue.Id, Text: text}, http.StatusCreated, &n)
	if n.BookingId != agenda.NoteDue.Id || n.Text != text || !n.WrittenAt.Equal(testutil.Now) {
		t.Errorf("note = %+v", n)
	}
	c.Post(base+"/session-notes", httpapi.SessionNoteInput{BookingId: agenda.NoteDue.Id, Text: "again"}, http.StatusBadRequest, nil)

	var after httpapi.PsychologistAgenda
	c.Get(base+"/psychologist-agenda", http.StatusOK, &after)
	if after.NoteDue != nil {
		t.Errorf("no note is due after writing it, got %+v", after.NoteDue)
	}
	var followUp bool
	for _, tp := range after.Topics {
		if strings.Contains(tp.Text, "Breathing") {
			t.Errorf("topic %q contains the note text", tp.Text)
		}
		followUp = followUp || strings.Contains(tp.Text, "last session")
	}
	if !followUp {
		t.Errorf("the note must add a follow-up topic, got %+v", after.Topics)
	}
}

func TestCareIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	base := careBase(mom)

	var agenda httpapi.PsychologistAgenda
	c.Get(base+"/psychologist-agenda", http.StatusOK, &agenda)
	var slots httpapi.PsychologistSlots
	c.Get(base+"/psychologist-slots", http.StatusOK, &slots)
	c.Post(base+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: slots.Items[0].Id}, http.StatusCreated, nil)
	c.Post(base+"/session-notes", httpapi.SessionNoteInput{BookingId: agenda.NoteDue.Id, Text: "ok"}, http.StatusCreated, nil)

	for _, w := range []struct {
		action, entity string
		n              int
	}{
		{"read", "psychologist_booking", 2}, // agenda and slots
		{"read", "session_note", 1},
		{"read", "mood_checkin", 1},
		{"create", "psychologist_booking", 1},
		{"create", "session_note", 1},
	} {
		if got := c.AuditCount(fam.Id, w.action, w.entity); got != w.n {
			t.Errorf("%s %s audit rows = %d, want %d", w.action, w.entity, got, w.n)
		}
	}
}

func TestSessionNoteChangesThePlan(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	base := careBase(mom)

	hasNextSession := func(p httpapi.Parent) bool {
		var pl httpapi.Plan
		c.Get(careBase(p)+"/plan", http.StatusOK, &pl)
		for _, it := range pl.Items {
			if it.RuleId == "psychologist-next-session" {
				return true
			}
		}
		return false
	}
	if hasNextSession(mom) {
		t.Fatal("no next-session item before a note is written")
	}
	var agenda httpapi.PsychologistAgenda
	c.Get(base+"/psychologist-agenda", http.StatusOK, &agenda)
	c.Post(base+"/session-notes", httpapi.SessionNoteInput{BookingId: agenda.NoteDue.Id, Text: "Went well."}, http.StatusCreated, nil)
	if !hasNextSession(mom) {
		t.Fatal("a session note with nothing booked must add the next-session item")
	}
	if hasNextSession(partner) {
		t.Fatal("the mother's note must not change the partner's plan")
	}
	var slots httpapi.PsychologistSlots
	c.Get(base+"/psychologist-slots", http.StatusOK, &slots)
	c.Post(base+"/psychologist-bookings", httpapi.PsychologistBookingInput{SlotId: slots.Items[0].Id}, http.StatusCreated, nil)
	if hasNextSession(mom) {
		t.Fatal("booking the next session must clear the item")
	}
}
