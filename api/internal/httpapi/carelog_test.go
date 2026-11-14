package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

type carePeople struct {
	fam          httpapi.Family
	mom, partner httpapi.Parent
	grandma      httpapi.Caregiver
	nanny        httpapi.Caregiver
}

func newbornFamily(c *testutil.Client, t *testing.T) carePeople {
	fam := c.StartDemo("newborn")
	p := carePeople{fam: fam, mom: testutil.Parent(t, fam, httpapi.ParentRoleMother), partner: testutil.Parent(t, fam, httpapi.ParentRolePartner)}
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleGrandparent {
			p.grandma = cg
		} else {
			p.nanny = cg
		}
	}
	return p
}

func careLog(id uuid.UUID) string  { return "/api/members/" + id.String() + "/care-log" }
func handoffs(id uuid.UUID) string { return "/api/members/" + id.String() + "/handoffs" }
func ago(d time.Duration) string   { return testutil.Now.Add(-d).Format(time.RFC3339) }

func TestCareLogNeedsABaby(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy") // no child yet
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Post(careLog(mom.Id), map[string]any{"kind": "sleep", "startedAt": ago(time.Hour)}, http.StatusConflict, nil)
	var l httpapi.CareLogList
	c.Get(careLog(mom.Id), http.StatusOK, &l)
	if len(l.Items) != 0 || l.Latest.LastFeed != nil || l.Latest.OnDuty != nil {
		t.Errorf("before Baby is home the log is empty, got %+v", l)
	}
}

func TestCareLogValidation(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	base := careLog(p.mom.Id)
	c.Post(base, map[string]any{"kind": "feed", "startedAt": ago(time.Hour)}, http.StatusBadRequest, nil)                                 // feed needs a method
	c.Post(base, map[string]any{"kind": "diaper", "startedAt": ago(time.Hour)}, http.StatusBadRequest, nil)                               // diaper needs content
	c.Post(base, map[string]any{"kind": "sleep", "startedAt": ago(time.Hour), "endedAt": ago(2 * time.Hour)}, http.StatusBadRequest, nil) // ends before it starts
	c.Post(base, map[string]any{"kind": "feed", "startedAt": ago(time.Hour), "feedMethod": "bottle_formula", "amountMl": 401}, http.StatusBadRequest, nil)
	c.Post(base, map[string]any{"kind": "nap", "startedAt": ago(time.Hour)}, http.StatusBadRequest, nil)
	c.Post(base, map[string]any{"kind": "sleep", "startedAt": ago(time.Hour), "childId": uuid.New()}, http.StatusBadRequest, nil)
	c.Get(base+"?kind=nap", http.StatusBadRequest, nil)
}

func TestCareLogListAndLatest(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	base := careLog(p.mom.Id)
	c.Post(base, map[string]any{"kind": "feed", "startedAt": ago(72 * time.Hour), "feedMethod": "breast_left"}, http.StatusCreated, nil) // older than 48 h
	var feed httpapi.CareLogEntry
	c.Post(base, map[string]any{"kind": "feed", "startedAt": ago(3 * time.Hour), "feedMethod": "bottle_breast_milk", "amountMl": 90, "note": "slow"}, http.StatusCreated, &feed)
	c.Post(base, map[string]any{"kind": "sleep", "startedAt": ago(2 * time.Hour), "endedAt": ago(time.Hour)}, http.StatusCreated, nil)
	c.Post(careLog(p.partner.Id), map[string]any{"kind": "diaper", "startedAt": ago(30 * time.Minute), "diaper": "both"}, http.StatusCreated, nil)
	if feed.AuthorId != p.mom.Id || feed.AmountMl == nil || *feed.AmountMl != 90 || feed.ChildId == uuid.Nil {
		t.Fatalf("entry = %+v", feed)
	}

	var l httpapi.CareLogList
	c.Get(base, http.StatusOK, &l)
	if len(l.Items) != 3 || l.Items[0].Kind != httpapi.Diaper || l.Items[2].Kind != httpapi.Feed {
		t.Fatalf("want 3 entries from the last 48 h, newest first, got %+v", l.Items)
	}
	if l.Latest.LastFeed == nil || l.Latest.LastFeed.Id != feed.Id || l.Latest.LastSleep == nil || l.Latest.LastDiaper == nil {
		t.Errorf("latest = %+v", l.Latest)
	}
	c.Get(base+"?kind=feed", http.StatusOK, &l)
	if len(l.Items) != 1 || l.Items[0].Id != feed.Id {
		t.Errorf("kind filter = %+v", l.Items)
	}
}

func TestCaregiversNeedCareLogPermission(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	c.Post(careLog(p.nanny.Id), map[string]any{"kind": "sleep", "startedAt": ago(time.Hour)}, http.StatusCreated, nil)
	c.Get(careLog(p.nanny.Id), http.StatusOK, nil)
	if n := c.AuditCount(p.fam.Id, "create", "care_log_entry"); n != 1 {
		t.Errorf("a caregiver's entry must be audited, got %d", n)
	}
	c.Post(careLog(p.mom.Id), map[string]any{"kind": "sleep", "startedAt": ago(time.Hour)}, http.StatusCreated, nil)
	if n := c.AuditCount(p.fam.Id, "create", "care_log_entry"); n != 1 {
		t.Errorf("a parent's entry is not audited, got %d rows", n)
	}
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{schedule}' WHERE id = $1`, p.nanny.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(careLog(p.nanny.Id), http.StatusForbidden, nil)
	c.Post(careLog(p.nanny.Id), map[string]any{"kind": "sleep", "startedAt": ago(time.Hour)}, http.StatusForbidden, nil)
	c.Get(handoffs(p.nanny.Id), http.StatusForbidden, nil)
	c.Post(handoffs(p.nanny.Id), map[string]any{"toMemberId": p.mom.Id}, http.StatusForbidden, nil)
}

func TestHandoffFlow(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	c.Post(careLog(p.mom.Id), map[string]any{"kind": "feed", "startedAt": ago(40 * time.Minute), "feedMethod": "bottle_formula", "amountMl": 80}, http.StatusCreated, nil)

	// Invalid: to myself, to a stranger, to someone without care_log.
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.mom.Id}, http.StatusConflict, nil)
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": uuid.New()}, http.StatusConflict, nil)
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{schedule}' WHERE id = $1`, p.grandma.Id); err != nil {
		t.Fatal(err)
	}
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.grandma.Id}, http.StatusConflict, nil)

	var h httpapi.Handoff
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.nanny.Id, "note": "Fed at 14:10. Napping since 14:40."}, http.StatusCreated, &h)
	if h.Status != httpapi.HandoffStatusPending || h.FromMemberId != p.mom.Id || h.CareSummary.LastFeed == nil || *h.CareSummary.LastFeed.AmountMl != 80 {
		t.Fatalf("handoff = %+v", h)
	}
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.partner.Id}, http.StatusConflict, nil) // one pending at a time

	// The nanny sees it (and the partner, as a parent, sees every handoff); grandma has no access.
	var l httpapi.HandoffList
	c.Get(handoffs(p.nanny.Id), http.StatusOK, &l)
	if len(l.Items) != 1 || l.Items[0].Id != h.Id {
		t.Errorf("nanny list = %+v", l.Items)
	}
	c.Get(handoffs(p.partner.Id), http.StatusOK, &l)
	if len(l.Items) != 1 {
		t.Errorf("a parent sees every handoff of the family: %+v", l.Items)
	}

	// Only the receiver accepts, once.
	c.Post(handoffs(p.mom.Id)+"/"+h.Id.String()+"/accept", nil, http.StatusConflict, nil)
	c.Post(handoffs(p.nanny.Id)+"/00000000-0000-4000-8000-000000000001/accept", nil, http.StatusNotFound, nil)
	var acc httpapi.Handoff
	c.Post(handoffs(p.nanny.Id)+"/"+h.Id.String()+"/accept", nil, http.StatusOK, &acc)
	if acc.Status != httpapi.HandoffStatusAccepted || acc.AcceptedAt == nil || acc.CareSummary.OnDuty == nil || acc.CareSummary.OnDuty.MemberId != p.nanny.Id {
		t.Fatalf("accepted = %+v", acc)
	}
	c.Post(handoffs(p.nanny.Id)+"/"+h.Id.String()+"/accept", nil, http.StatusConflict, nil)

	// Now the nanny is on duty in the care log, and can hand back.
	var log httpapi.CareLogList
	c.Get(careLog(p.mom.Id), http.StatusOK, &log)
	if log.Latest.OnDuty == nil || log.Latest.OnDuty.MemberId != p.nanny.Id || log.Latest.OnDuty.Via != httpapi.OnDutyViaHandoff {
		t.Errorf("on duty = %+v", log.Latest.OnDuty)
	}
	c.Post(handoffs(p.nanny.Id), map[string]any{"toMemberId": p.mom.Id}, http.StatusCreated, nil)
	if n := c.AuditCount(p.fam.Id, "update", "handoff"); n != 1 {
		t.Errorf("the nanny's accept must be audited, got %d", n)
	}
}

func TestPendingHandoffsListFirstAndFamilyScope(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	var first, second httpapi.Handoff
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.partner.Id}, http.StatusCreated, &first)
	c.Post(handoffs(p.partner.Id)+"/"+first.Id.String()+"/accept", nil, http.StatusOK, nil)
	c.Post(handoffs(p.partner.Id), map[string]any{"toMemberId": p.nanny.Id}, http.StatusCreated, &second)
	var l httpapi.HandoffList
	c.Get(handoffs(p.mom.Id), http.StatusOK, &l)
	if len(l.Items) != 2 || l.Items[0].Id != second.Id || l.Items[1].Id != first.Id {
		t.Errorf("pending first, then newest: %+v", l.Items)
	}

	other := newbornFamily(c, t) // the client now holds another family's session
	c.Post(handoffs(other.nanny.Id)+"/"+second.Id.String()+"/accept", nil, http.StatusNotFound, nil)
	c.Get(careLog(p.mom.Id), http.StatusNotFound, nil)
}
