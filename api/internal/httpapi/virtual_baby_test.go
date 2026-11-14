package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestVirtualBabySeedShowsAFinishedEveningWithStickers(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var vb httpapi.VirtualBaby
	c.Get(memberPath(mom.Id)+"/virtual-baby", http.StatusOK, &vb)
	if len(vb.Items) != 1 {
		t.Fatalf("%d sessions, want the seeded one", len(vb.Items))
	}
	s := vb.Items[0]
	if s.Mode != httpapi.Evening || s.FinishedAt == nil || s.Next != nil || len(s.Moments) != s.MomentCount || s.StartedBy != dad.Id {
		t.Fatalf("seeded session = mode %s finished %v next %v moments %d/%d", s.Mode, s.FinishedAt, s.Next, len(s.Moments), s.MomentCount)
	}
	for _, m := range s.Moments {
		if m.Feedback.Source.Url == "" || m.Feedback.Why == "" {
			t.Errorf("moment %d has no sourced feedback", m.Seq)
		}
	}
	got := map[httpapi.VirtualBabyStickerId]bool{}
	for _, st := range vb.Stickers {
		got[st.Id] = true
	}
	for _, want := range []httpapi.VirtualBabyStickerId{httpapi.FeedingCues, httpapi.FreshDiaper, httpapi.BackToSleep, httpapi.CalmAndSteady, httpapi.TagTeam} {
		if !got[want] {
			t.Errorf("missing sticker %s in %+v", want, vb.Stickers)
		}
	}
	if got[httpapi.NightOwl] || got[httpapi.FortyEight] {
		t.Errorf("an evening earns no night or 48-hour sticker: %+v", vb.Stickers)
	}
}

func TestVirtualBabyPartnersTakeTurns(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var s httpapi.VirtualBabySession
	c.Post(memberPath(mom.Id)+"/virtual-baby-sessions", map[string]any{"mode": "challenge"}, http.StatusCreated, &s)
	if s.Next == nil || s.Next.Seq != 0 || s.LengthMinutes != 2880 || s.StartClock != 480 || s.MomentCount < 20 {
		t.Fatalf("new challenge = %+v", s)
	}
	c.Post(memberPath(dad.Id)+"/virtual-baby-sessions", map[string]any{"mode": "evening"}, http.StatusConflict, nil)
	c.Post(memberPath(mom.Id)+"/virtual-baby-sessions", map[string]any{"mode": "weekend"}, http.StatusBadRequest, nil)

	moments := memberPath(mom.Id) + "/virtual-baby-sessions/" + s.Id.String() + "/moments"
	c.Post(moments, map[string]any{"seq": 0, "choiceId": "nope"}, http.StatusBadRequest, nil)

	var r httpapi.VirtualBabyMomentResult
	c.Post(moments, map[string]any{"seq": 0, "choiceId": "wait-cry"}, http.StatusCreated, &r)
	if r.Moment.HandledBy != mom.Id || r.Moment.Feedback.Fit != httpapi.AnotherWay || r.Moment.Feedback.Source.Url == "" || r.Moment.Need != httpapi.VirtualBabyNeedHungry {
		t.Errorf("mom's moment = %+v", r.Moment)
	}
	// The hunger meter restarts at the moment she answered.
	for _, n := range r.Session.Needs {
		if n.Need == httpapi.VirtualBabyNeedHungry && n.Since != r.Moment.Minute {
			t.Errorf("hungry since %d, want %d", n.Since, r.Moment.Minute)
		}
	}
	// The same moment again (the partner was slower): 409, nothing recorded twice.
	c.Post(memberPath(dad.Id)+"/virtual-baby-sessions/"+s.Id.String()+"/moments", map[string]any{"seq": 0, "choiceId": "feed"}, http.StatusConflict, nil)

	next := r.Session.Next
	c.Post(memberPath(dad.Id)+"/virtual-baby-sessions/"+s.Id.String()+"/moments", map[string]any{"seq": next.Seq, "choiceId": next.Choices[0].Id}, http.StatusCreated, &r)
	if r.Moment.HandledBy != dad.Id || len(r.Session.Moments) != 2 {
		t.Errorf("dad's moment = %+v", r.Moment)
	}
	if len(r.Session.Practised) != 2 {
		t.Errorf("practised = %+v", r.Session.Practised)
	}

	var vb httpapi.VirtualBaby
	c.Get(memberPath(dad.Id)+"/virtual-baby", http.StatusOK, &vb)
	if vb.Items[0].Id != s.Id || vb.Items[0].FinishedAt != nil {
		t.Errorf("the active session comes first: %+v", vb.Items[0])
	}

	var ended httpapi.VirtualBabySession
	c.Patch(memberPath(dad.Id)+"/virtual-baby-sessions/"+s.Id.String(), map[string]any{"finished": true}, http.StatusOK, &ended)
	if ended.FinishedAt == nil || ended.Next != nil || len(ended.Moments) != 2 {
		t.Errorf("ended = %+v", ended)
	}
	c.Patch(memberPath(dad.Id)+"/virtual-baby-sessions/"+s.Id.String(), map[string]any{"finished": true}, http.StatusOK, nil)
	c.Patch(memberPath(dad.Id)+"/virtual-baby-sessions/"+s.Id.String(), map[string]any{"finished": false}, http.StatusBadRequest, nil)
	c.Post(moments, map[string]any{"seq": 2, "choiceId": "back"}, http.StatusConflict, nil)
	c.Get(memberPath(dad.Id)+"/virtual-baby", http.StatusOK, &vb)
	c.Post(memberPath(dad.Id)+"/virtual-baby-sessions", map[string]any{"mode": "evening"}, http.StatusCreated, nil)
}

func TestVirtualBabyEveningPlaysToTheEnd(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var s httpapi.VirtualBabySession
	c.Post(memberPath(mom.Id)+"/virtual-baby-sessions", map[string]any{"mode": "evening"}, http.StatusCreated, &s)
	for i := 0; s.Next != nil; i++ {
		who := mom.Id
		if i%2 == 1 {
			who = dad.Id
		}
		var r httpapi.VirtualBabyMomentResult
		c.Post(memberPath(who)+"/virtual-baby-sessions/"+s.Id.String()+"/moments", map[string]any{"seq": s.Next.Seq, "choiceId": s.Next.Choices[0].Id}, http.StatusCreated, &r)
		s = r.Session
	}
	if s.FinishedAt == nil || len(s.Moments) != s.MomentCount {
		t.Fatalf("finished %v with %d of %d moments", s.FinishedAt, len(s.Moments), s.MomentCount)
	}
	// A new one can start once this one is over.
	c.Post(memberPath(dad.Id)+"/virtual-baby-sessions", map[string]any{"mode": "evening"}, http.StatusCreated, nil)
}

func TestVirtualBabyIsForParentsOfThisFamilyOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var s httpapi.VirtualBabySession
	c.Post(memberPath(mom.Id)+"/virtual-baby-sessions", map[string]any{"mode": "evening"}, http.StatusCreated, &s)
	calls := func(m string, status int) {
		t.Helper()
		c.Get(m+"/virtual-baby", status, nil)
		c.Post(m+"/virtual-baby-sessions", map[string]any{"mode": "evening"}, status, nil)
		c.Post(m+"/virtual-baby-sessions/"+s.Id.String()+"/moments", map[string]any{"seq": 0, "choiceId": "feed"}, status, nil)
		c.Patch(m+"/virtual-baby-sessions/"+s.Id.String(), map[string]any{"finished": true}, status, nil)
	}
	if len(fam.Caregivers) == 0 {
		t.Fatal("the pregnancy demo has caregivers")
	}
	for _, cg := range fam.Caregivers {
		calls(memberPath(cg.Id), http.StatusNotFound)
	}
	other := c.StartDemo("pregnancy") // the client now holds another family's session
	calls(memberPath(mom.Id), http.StatusNotFound)
	otherMom := testutil.Parent(t, other, httpapi.ParentRoleMother)
	// A session id of the first family is not found from the second one.
	c.Post(memberPath(otherMom.Id)+"/virtual-baby-sessions/"+s.Id.String()+"/moments", map[string]any{"seq": 0, "choiceId": "feed"}, http.StatusNotFound, nil)
	c.Patch(memberPath(otherMom.Id)+"/virtual-baby-sessions/"+s.Id.String(), map[string]any{"finished": true}, http.StatusNotFound, nil)
	var vb httpapi.VirtualBaby
	c.Get(memberPath(otherMom.Id)+"/virtual-baby", http.StatusOK, &vb)
	for _, it := range vb.Items {
		if it.Id == s.Id {
			t.Error("another family's session is listed")
		}
	}
}
