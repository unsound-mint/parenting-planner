package httpapi_test

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

type update struct {
	Kind     string    `json:"kind"`
	EntityID string    `json:"entityId"`
	ActorID  uuid.UUID `json:"actorId"`
}

func famPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/family" }

func livePath(id uuid.UUID) string { return "/api/members/" + id.String() + "/live" }

// openLive opens the stream as a person and returns the updates it receives.
func openLive(t *testing.T, c *testutil.Client, id uuid.UUID) <-chan update {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	resp := c.Stream(ctx, livePath(id), http.StatusOK)
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content type = %q", ct)
	}
	// no-transform stops proxies from compressing or buffering the stream.
	if cc := resp.Header.Get("Cache-Control"); cc != "no-cache, no-transform" {
		t.Fatalf("Cache-Control = %q", cc)
	}
	out := make(chan update, 16)
	ready := make(chan struct{})
	go func() {
		defer resp.Body.Close()
		sc := bufio.NewScanner(resp.Body)
		for sc.Scan() {
			line := sc.Text()
			if line == ": connected" {
				close(ready)
			}
			if data, ok := strings.CutPrefix(line, "data: "); ok {
				var u update
				if json.Unmarshal([]byte(data), &u) == nil {
					out <- u
				}
			}
		}
	}()
	select {
	case <-ready:
	case <-time.After(3 * time.Second):
		t.Fatal("the stream did not open")
	}
	return out
}

func next(t *testing.T, ch <-chan update, within time.Duration) update {
	t.Helper()
	select {
	case u := <-ch:
		return u
	case <-time.After(within):
		t.Fatalf("no update within %s", within)
		return update{}
	}
}

func TestLiveNeedsASessionAndAKnownPerson(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	for _, cg := range fam.Caregivers { // any family member may open the stream
		openLive(t, c, cg.Id)
	}
	stranger := testutil.New(t)
	stranger.Get(livePath(testutil.Parent(t, fam, httpapi.ParentRoleMother).Id), http.StatusUnauthorized, nil)
	first := testutil.Parent(t, fam, httpapi.ParentRoleMother).Id
	c.StartDemo("pregnancy") // the client now holds another family's session
	c.Get(livePath(first), http.StatusNotFound, nil)
}

func TestLiveShowsAChangeOnAnotherScreenWithinFiveSeconds(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	mom := openLive(t, c, p.mom.Id)

	started := time.Now()
	var entry httpapi.CareLogEntry
	c.Post(careLog(p.partner.Id), map[string]any{"kind": "diaper", "startedAt": ago(time.Minute), "diaper": "wet"}, http.StatusCreated, &entry)
	u := next(t, mom, 5*time.Second)
	if u.Kind != "care_log" || u.EntityID != entry.Id.String() || u.ActorID != p.partner.Id {
		t.Errorf("update = %+v, want care_log %s by the partner", u, entry.Id)
	}
	if took := time.Since(started); took > 5*time.Second {
		t.Errorf("took %s", took)
	}
}

func TestLiveStartsFromNowAndTellsEveryoneAboutFamilyChanges(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	c.Post(careLog(p.mom.Id), map[string]any{"kind": "sleep", "startedAt": ago(time.Hour)}, http.StatusCreated, nil) // before anyone listens
	nanny := openLive(t, c, p.nanny.Id)
	c.Patch(famPath(p.mom), map[string]any{"stage": "infant"}, http.StatusOK, nil)
	u := next(t, nanny, 5*time.Second)
	if u.Kind != "family" || u.ActorID != p.mom.Id {
		t.Errorf("a caregiver hears about family changes, and only new ones: %+v", u)
	}
}

func TestLiveSendsOnlyWhatThePersonMayRead(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	jake, nanny := openLive(t, c, p.partner.Id), openLive(t, c, p.nanny.Id)
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{schedule}' WHERE id = $1`, p.nanny.Id); err != nil {
		t.Fatal(err)
	}

	// Mom's private event is not Jake's business; her family event is.
	var private, family httpapi.CalendarEvent
	c.Post(calBase(p.mom), event("Therapy", "private", 24*time.Hour), http.StatusCreated, &private)
	c.Post(calBase(p.mom), event("OB visit", "family", 48*time.Hour), http.StatusCreated, &family)
	if u := next(t, jake, 5*time.Second); u.Kind != "calendar_event" || u.EntityID != family.Id {
		t.Errorf("partner got %+v, want the family event first (%s)", u, family.Id)
	}

	// An invitation is for the parents; a care log entry needs care_log; neither reaches the nanny.
	c.Post("/api/members/"+p.mom.Id.String()+"/invitations", inviteBody("grandparent", "care_log"), http.StatusCreated, nil)
	if u := next(t, jake, 5*time.Second); u.Kind != "invitation" {
		t.Errorf("partner got %+v, want the invitation", u)
	}
	c.Post(careLog(p.mom.Id), map[string]any{"kind": "sleep", "startedAt": ago(time.Minute)}, http.StatusCreated, nil)
	c.Patch(famPath(p.mom), map[string]any{"stage": "infant"}, http.StatusOK, nil) // a marker everyone gets
	if u := next(t, nanny, 5*time.Second); u.Kind != "family" {
		t.Errorf("nanny without care_log got %+v, want only the family change", u)
	}
	// Jake, a parent, got the care log entry before the marker.
	if u := next(t, jake, 5*time.Second); u.Kind != "care_log" {
		t.Errorf("partner got %+v, want the care log entry", u)
	}
}

func TestLiveShiftGoesToTheParentsAndTheOwner(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	jake, grandma := openLive(t, c, p.partner.Id), openLive(t, c, p.grandma.Id)
	c.Post(shiftsPath(p.nanny.Id), shiftBody("Nanny days", "08:00", "16:00", "tue"), http.StatusCreated, nil)
	if u := next(t, jake, 5*time.Second); u.Kind != "shift" || u.ActorID != p.nanny.Id {
		t.Errorf("partner got %+v, want the nanny's shift", u)
	}
	c.Patch(famPath(p.mom), map[string]any{"stage": "infant"}, http.StatusOK, nil)
	if u := next(t, grandma, 5*time.Second); u.Kind != "family" {
		t.Errorf("another caregiver must not hear about the nanny's shift, got %+v", u)
	}
}

func TestLiveEndsWhenACaregiverIsRevoked(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	resp := c.Stream(ctx, livePath(p.nanny.Id), http.StatusOK)
	defer resp.Body.Close()
	done := make(chan struct{})
	go func() {
		_, _ = bufio.NewReader(resp.Body).WriteTo(discard{}) // returns when the server ends the stream
		close(done)
	}()
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET revoked_at = now() WHERE id = $1`, p.nanny.Id); err != nil {
		t.Fatal(err)
	}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the stream of a revoked caregiver must end")
	}
}

type discard struct{}

func (discard) Write(b []byte) (int, error) { return len(b), nil }
