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

func TestAppointmentNoteIsPrivateAndReplaceable(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var eventOut httpapi.CalendarEvent
	c.Post(calBase(mom), event("Shared visit", "family", -time.Hour), http.StatusCreated, &eventOut)
	visit := "/appointments/" + eventOut.Id
	mother := "/api/members/" + mom.Id.String() + visit
	other := "/api/members/" + partner.Id.String() + visit

	var saved httpapi.AppointmentNote
	c.Put(mother+"/note", map[string]string{"text": "initial"}, http.StatusOK, &saved)
	if saved.Text != "initial" || saved.UpdatedAt.IsZero() {
		t.Fatalf("save response: %+v", saved)
	}
	c.Put(mother+"/note", map[string]string{"text": strings.Repeat("a", 2001)}, http.StatusBadRequest, nil)
	c.Put(mother+"/note", map[string]string{"text": "updated"}, http.StatusOK, nil)
	read := func(path string) *httpapi.AppointmentNote {
		var prep httpapi.AppointmentPrep
		c.Get(path+"/prep", http.StatusOK, &prep)
		return prep.Note
	}
	if note := read(other); note != nil {
		t.Fatalf("partner sees the author's note: %+v", note)
	}
	c.Put(other+"/note", map[string]string{"text": "partner's own note"}, http.StatusOK, nil)
	if note := read(mother); note == nil || note.Text != "updated" {
		t.Fatalf("the partner's note changed the author's note: %+v", note)
	}
	c.Put(mother+"/note", map[string]string{"text": ""}, http.StatusOK, nil)
	if read(mother) != nil || read(other) == nil {
		t.Fatal("delete must affect just the acting parent")
	}
	if c.AuditCount(fam.Id, "read", "appointment_note") == 0 || c.AuditCount(fam.Id, "delete", "appointment_note") != 1 {
		t.Fatal("note reads and deletes must be audited")
	}

	if len(fam.Caregivers) == 0 {
		t.Fatal("pregnancy template must have a caregiver")
	}
	caregiver := "/api/members/" + fam.Caregivers[0].Id.String() + visit
	c.Get(caregiver+"/prep", http.StatusNotFound, nil)
	c.Put(caregiver+"/note", map[string]string{"text": "no"}, http.StatusNotFound, nil)

	another := c.StartDemo("pregnancy")
	anotherMom := testutil.Parent(t, another, httpapi.ParentRoleMother)
	c.Put("/api/members/"+anotherMom.Id.String()+visit+"/note", map[string]string{"text": "no"}, http.StatusNotFound, nil)
}

func TestAppointmentNoteUsesTheFamilyClock(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var e httpapi.CalendarEvent
	c.Post(calBase(mom), event("Future visit", "private", 24*time.Hour), http.StatusCreated, &e)
	path := "/api/members/" + mom.Id.String() + "/appointments/" + e.Id + "/note"
	c.Put(path, map[string]string{"text": "too soon"}, http.StatusConflict, nil)
	c.Post("/api/family/demo-time-skips", nil, http.StatusOK, nil)
	c.Put(path, map[string]string{"text": "visit started"}, http.StatusOK, nil)
}

func TestVisitPrepKeepsUnansweredQuestionsAfterCarryOver(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	list := aqList(c, mom.Id, "")
	q := aqByText(list, "Is the back pain normal at this stage?")
	if q.Id == uuid.Nil || !q.CarriedOver {
		t.Fatalf("expected a seeded carried question, got %+v", q)
	}
	var prep httpapi.AppointmentPrep
	c.Get("/api/members/"+mom.Id.String()+"/appointments/"+q.AskedForAppointmentId.String()+"/prep", http.StatusOK, &prep)
	for _, candidate := range prep.Questions {
		if candidate.Id == q.Id {
			return
		}
	}
	t.Fatalf("past visit no longer contains the question it started with: %+v", prep.Questions)
}
