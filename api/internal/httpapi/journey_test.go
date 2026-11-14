package httpapi_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func getJourney(c *testutil.Client, p httpapi.Parent) httpapi.Journey {
	var j httpapi.Journey
	c.Get("/api/members/"+p.Id.String()+"/journey", http.StatusOK, &j)
	return j
}

// statuses reads the timeline as "stage:status" pairs in order.
func statuses(j httpapi.Journey) string {
	out := []string{}
	for _, s := range j.Stages {
		out = append(out, string(s.Stage)+":"+string(s.Status))
	}
	return strings.Join(out, ",")
}

func span(t *testing.T, j httpapi.Journey, stage httpapi.JourneyStage) httpapi.JourneySpan {
	t.Helper()
	for _, s := range j.Stages {
		if s.Stage == stage {
			return s
		}
	}
	t.Fatalf("no %s stage", stage)
	return httpapi.JourneySpan{}
}

func date(d interface{ String() string }) string { return d.String() }

// upcomingMatchesPlan checks the timeline shows the head of the same plan,
// in the same order, so nothing on it is hardcoded.
func upcomingMatchesPlan(t *testing.T, c *testutil.Client, p httpapi.Parent, j httpapi.Journey) {
	t.Helper()
	var pl httpapi.Plan
	c.Get("/api/members/"+p.Id.String()+"/plan", http.StatusOK, &pl)
	want := pl.Items[:min(len(pl.Items), 5)]
	if len(j.Upcoming) != len(want) {
		t.Fatalf("upcoming has %d items, plan head has %d", len(j.Upcoming), len(want))
	}
	for i := range want {
		if j.Upcoming[i].RuleId != want[i].RuleId || j.Upcoming[i].Source.Url == "" {
			t.Errorf("upcoming[%d] = %s, want %s with a source", i, j.Upcoming[i].RuleId, want[i].RuleId)
		}
	}
}

func TestJourneyPregnancy(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	j := getJourney(c, mom)

	if j.Current.Stage != httpapi.JourneyStagePregnancy || j.Current.GestationalWeek == nil || *j.Current.GestationalWeek != *fam.GestationalWeek {
		t.Fatalf("current = %+v, family week %d", j.Current, *fam.GestationalWeek)
	}
	if j.Current.ChildId != nil {
		t.Errorf("no child yet, got %v", j.Current.ChildId)
	}
	if got := statuses(j); got != "planning:past,pregnancy:current,birth:future,newborn:future,first_year:future,toddler:future,preschool:future,school_age:future" {
		t.Errorf("stages = %s", got)
	}
	// Every stage after planning is dated from the due date.
	if b := span(t, j, httpapi.JourneyStageBirth); b.StartsOn == nil || date(b.StartsOn) != date(fam.DueDate) || date(b.EndsOn) != date(fam.DueDate) {
		t.Errorf("birth = %+v, due %s", b, fam.DueDate)
	}
	if p := span(t, j, httpapi.JourneyStagePlanning); p.StartsOn != nil || p.EndsOn != nil {
		t.Errorf("planning has no dates, got %+v", p)
	}
	if got := strings.Join(ruleIDs(j.Upcoming), ","); got != "glucose-screen,tdap-pregnancy" {
		t.Errorf("mother upcoming = %s", got)
	}
	upcomingMatchesPlan(t, c, mom, j)

	// The partner sees the same timeline with his own items.
	dad := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	jd := getJourney(c, dad)
	if statuses(jd) != statuses(j) || strings.Join(ruleIDs(jd.Upcoming), ",") != "tdap-partner" {
		t.Errorf("partner journey = %s / %v", statuses(jd), ruleIDs(jd.Upcoming))
	}
}

func TestJourneyPlanning(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("planning")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	j := getJourney(c, mom)
	if j.Current.Stage != httpapi.JourneyStagePlanning || j.Current.GestationalWeek != nil || j.Current.ChildId != nil {
		t.Fatalf("current = %+v", j.Current)
	}
	if got := statuses(j); got != "planning:current,pregnancy:future,birth:future,newborn:future,first_year:future,toddler:future,preschool:future,school_age:future" {
		t.Errorf("stages = %s", got)
	}
	for _, s := range j.Stages {
		if s.StartsOn != nil || s.EndsOn != nil {
			t.Errorf("no due date or child, so %s has no dates: %+v", s.Stage, s)
		}
	}
	upcomingMatchesPlan(t, c, mom, j)
}

func TestJourneyNewborn(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	leo := fam.Children[0]
	for _, p := range fam.Parents {
		j := getJourney(c, p)
		if j.Current.Stage != httpapi.JourneyStageNewborn || j.Current.ChildId == nil || *j.Current.ChildId != leo.Id {
			t.Fatalf("current = %+v", j.Current)
		}
		if *j.Current.ChildAgeWeeks != 7 || *j.Current.ChildAgeMonths != leo.AgeMonths {
			t.Errorf("age = %d weeks, %d months; child ageMonths %d", *j.Current.ChildAgeWeeks, *j.Current.ChildAgeMonths, leo.AgeMonths)
		}
		if got := statuses(j); got != "planning:past,pregnancy:past,birth:past,newborn:current,first_year:future,toddler:future,preschool:future,school_age:future" {
			t.Errorf("stages = %s", got)
		}
		if b := span(t, j, httpapi.JourneyStageBirth); date(b.StartsOn) != date(&leo.BirthDate) {
			t.Errorf("birth = %+v, born %s", b, leo.BirthDate)
		}
		upcomingMatchesPlan(t, c, p, j)
	}
}

func TestJourneyPreschool(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	ava := fam.Children[0]
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	j := getJourney(c, mom)
	if j.Current.Stage != httpapi.JourneyStagePreschool || *j.Current.ChildAgeMonths != ava.AgeMonths || ava.AgeMonths != 49 {
		t.Fatalf("current = %+v, ava %d months", j.Current, ava.AgeMonths)
	}
	if got := statuses(j); got != "planning:past,pregnancy:past,birth:past,newborn:past,first_year:past,toddler:past,preschool:current,school_age:future" {
		t.Errorf("stages = %s", got)
	}
	// Preschool runs from the 3rd to the 5th birthday, school age to the 9th.
	born := ava.BirthDate.Time
	pre, school := span(t, j, httpapi.JourneyStagePreschool), span(t, j, httpapi.JourneyStageSchoolAge)
	if pre.StartsOn.Time != born.AddDate(3, 0, 0) || pre.EndsOn.Time != born.AddDate(5, 0, -1) {
		t.Errorf("preschool = %s to %s, born %s", pre.StartsOn, pre.EndsOn, born)
	}
	if school.StartsOn.Time != born.AddDate(5, 0, 0) || school.EndsOn.Time != born.AddDate(9, 0, -1) {
		t.Errorf("school age = %s to %s, born %s", school.StartsOn, school.EndsOn, born)
	}
	upcomingMatchesPlan(t, c, mom, j)
}

// Recording the glucose screen takes it off the timeline: the items come
// from the rules engine and the family's data, not fixed text.
func TestJourneyFollowsTheFamilyData(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	_, err := store.New(c.Pool).CreateLabResult(context.Background(), store.CreateLabResultParams{
		FamilyID: fam.Id, SubjectMemberID: uuid.NullUUID{UUID: mom.Id, Valid: true}, OwnerMemberID: mom.Id,
		Visibility: "family", Kind: "glucose_screen", TakenOn: testutil.Now.AddDate(0, 0, -1), Result: []byte(`{"mg_dl": 120}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	j := getJourney(c, mom)
	if got := strings.Join(ruleIDs(j.Upcoming), ","); got != "tdap-pregnancy" {
		t.Errorf("upcoming after the glucose screen = %s", got)
	}
}

func TestJourneyAccess(t *testing.T) {
	c := testutil.New(t)
	other := testutil.Parent(t, c.StartDemo("newborn"), httpapi.ParentRoleMother)
	c.StartDemo("preschool") // the client now holds another family's session
	c.Get("/api/members/"+other.Id.String()+"/journey", http.StatusNotFound, nil)

	anon := testutil.New(t)
	anon.Get("/api/members/"+other.Id.String()+"/journey", http.StatusUnauthorized, nil)
}

func ruleIDs(items []httpapi.PlanItem) []string {
	ids := []string{}
	for _, it := range items {
		ids = append(ids, it.RuleId)
	}
	return ids
}
