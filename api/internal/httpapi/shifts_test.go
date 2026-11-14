package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func shiftsPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/shifts" }

func shiftBody(title, start, end string, days ...string) map[string]any {
	return map[string]any{"title": title, "days": days, "startTime": start, "endTime": end}
}

func TestShiftValidation(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	base := shiftsPath(p.mom.Id)
	c.Post(base, shiftBody("x", "22:00", "02:00"), http.StatusBadRequest, nil)               // no days
	c.Post(base, shiftBody("x", "22:00", "02:00", "mon", "mon"), http.StatusBadRequest, nil) // duplicate days
	c.Post(base, shiftBody("x", "22:00", "02:00", "funday"), http.StatusBadRequest, nil)     // not a weekday
	c.Post(base, shiftBody("x", "25:00", "02:00", "mon"), http.StatusBadRequest, nil)        // not a time
	c.Post(base, shiftBody("x", "9:00", "10:00", "mon"), http.StatusBadRequest, nil)         // not HH:MM
	c.Post(base, shiftBody("", "09:00", "10:00", "mon"), http.StatusBadRequest, nil)         // no title
	c.Post(base, shiftBody("x", "09:00", "09:00", "mon"), http.StatusBadRequest, nil)        // same time
}

func TestShiftOverlapOnlyCountsOwnShifts(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	c.Post(shiftsPath(p.mom.Id), shiftBody("Night", "22:00", "02:00", "mon", "wed"), http.StatusCreated, nil)
	c.Post(shiftsPath(p.mom.Id), shiftBody("Early", "01:00", "03:00", "tue"), http.StatusConflict, nil)    // runs into Monday night's shift
	c.Post(shiftsPath(p.mom.Id), shiftBody("Morning", "07:00", "09:00", "mon"), http.StatusCreated, nil)   // free
	c.Post(shiftsPath(p.partner.Id), shiftBody("Night", "22:00", "02:00", "mon"), http.StatusCreated, nil) // someone else's overlap is fine
}

func TestAgreedShiftsBecomeActiveWhenTheBabyIsHome(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var sh httpapi.Shift
	c.Post(shiftsPath(jake.Id), shiftBody("First night", "22:00", "02:00", "sat"), http.StatusCreated, &sh)
	if sh.Status != httpapi.ShiftStatusAgreed || sh.StartsOn != nil || sh.MemberId != jake.Id {
		t.Fatalf("before the baby is home a shift is agreed: %+v", sh)
	}
	var l httpapi.CalendarEventList
	c.Get(calBase(mom)+"?scope=family&from=2026-11-14&to=2026-11-20", http.StatusOK, &l)
	for _, e := range l.Items {
		if e.Kind == httpapi.CalendarEventKindShift {
			t.Fatalf("an agreed shift has no calendar occurrences: %+v", e)
		}
	}

	c.Post(arrivalPath(mom), map[string]any{"name": "Ava", "birthDate": testutil.Now.Format("2006-01-02")}, http.StatusCreated, nil)
	var list httpapi.ShiftList
	c.Get(shiftsPath(mom.Id), http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].Status != httpapi.ShiftStatusActive || list.Items[0].StartsOn == nil || list.Items[0].StartsOn.Format("2006-01-02") != "2026-11-14" {
		t.Fatalf("Baby is home must activate the shift from today: %+v", list.Items)
	}
	// Now every calendar that may see it shows the occurrence: Sat 14th 22:00 to Sun 02:00.
	for name, tc := range map[string]struct {
		viewer httpapi.Parent
		scope  string
	}{"mom family": {mom, "family"}, "mom partner": {mom, "partner"}, "jake mine": {jake, "mine"}} {
		c.Get(calBase(tc.viewer)+"?scope="+tc.scope+"&from=2026-11-14&to=2026-11-20", http.StatusOK, &l)
		found := false
		for _, e := range l.Items {
			if e.Kind == httpapi.CalendarEventKindShift {
				found = true
				if e.Id != sh.Id.String()+":2026-11-14" || e.ShiftId == nil || *e.ShiftId != sh.Id || e.OwnerId == nil || *e.OwnerId != jake.Id ||
					!e.StartsAt.Equal(time.Date(2026, 11, 14, 22, 0, 0, 0, time.UTC)) || e.EndsAt == nil || !e.EndsAt.Equal(time.Date(2026, 11, 15, 2, 0, 0, 0, time.UTC)) {
					t.Errorf("%s: occurrence = %+v", name, e)
				}
			}
		}
		if !found {
			t.Errorf("%s does not show the shift", name)
		}
	}
	c.Get(calBase(mom)+"?scope=mine&from=2026-11-14&to=2026-11-20", http.StatusOK, &l)
	for _, e := range l.Items {
		if e.Kind == httpapi.CalendarEventKindShift {
			t.Error("Jake's shift is not in Mom's mine")
		}
	}
}

func TestShiftPermissionsAndVisibility(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	c.Post(shiftsPath(p.mom.Id), shiftBody("Mom nights", "22:00", "02:00", "mon"), http.StatusCreated, nil)
	c.Post(shiftsPath(p.nanny.Id), shiftBody("Nanny days", "08:00", "16:00", "tue", "wed"), http.StatusCreated, nil)

	var l httpapi.ShiftList
	c.Get(shiftsPath(p.mom.Id), http.StatusOK, &l)
	if len(l.Items) != 2 || l.Items[0].Title != "Mom nights" { // ordered by first weekday: mon before tue
		t.Errorf("a parent sees every shift, by first weekday: %+v", l.Items)
	}
	c.Get(shiftsPath(p.nanny.Id), http.StatusOK, &l)
	if len(l.Items) != 1 || l.Items[0].MemberId != p.nanny.Id {
		t.Errorf("a caregiver sees only their own: %+v", l.Items)
	}
	// The nanny's own calendar shows her shift; the parents' family calendar does too.
	var cal httpapi.CalendarEventList
	c.Get("/api/members/"+p.nanny.Id.String()+"/calendar-events?from=2026-11-16&to=2026-11-20", http.StatusOK, &cal)
	if len(cal.Items) != 2 || cal.Items[0].Kind != httpapi.CalendarEventKindShift {
		t.Errorf("nanny calendar = %+v", cal.Items)
	}
	c.Get(calBase(p.mom)+"?scope=partner&from=2026-11-16&to=2026-11-20", http.StatusOK, &cal)
	for _, e := range cal.Items {
		if e.Kind == httpapi.CalendarEventKindShift {
			t.Errorf("a caregiver's shift is not the partner's: %+v", e)
		}
	}

	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{care_log}' WHERE id = $1`, p.nanny.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(shiftsPath(p.nanny.Id), http.StatusForbidden, nil)
	c.Post(shiftsPath(p.nanny.Id), shiftBody("x", "08:00", "09:00", "fri"), http.StatusForbidden, nil)
}

func TestOnDutyFollowsTheShiftUntilAHandoffIsAccepted(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	// Now is Saturday 15:00 UTC: the nanny's Saturday afternoon shift covers it.
	c.Post(shiftsPath(p.nanny.Id), shiftBody("Saturday", "14:00", "18:00", "sat"), http.StatusCreated, nil)
	var log httpapi.CareLogList
	c.Get(careLog(p.mom.Id), http.StatusOK, &log)
	d := log.Latest.OnDuty
	if d == nil || d.MemberId != p.nanny.Id || d.Via != httpapi.OnDutyViaShift || !d.Since.Equal(time.Date(2026, 11, 14, 14, 0, 0, 0, time.UTC)) {
		t.Fatalf("on duty = %+v, want the nanny via her shift since 14:00", d)
	}
	// A handoff accepted after the shift began takes over.
	var h httpapi.Handoff
	c.Post(handoffs(p.nanny.Id), map[string]any{"toMemberId": p.mom.Id}, http.StatusCreated, &h)
	c.Post(handoffs(p.mom.Id)+"/"+h.Id.String()+"/accept", nil, http.StatusOK, nil)
	c.Get(careLog(p.mom.Id), http.StatusOK, &log)
	if d := log.Latest.OnDuty; d == nil || d.MemberId != p.mom.Id || d.Via != httpapi.OnDutyViaHandoff {
		t.Errorf("on duty after the handoff = %+v", d)
	}
}
