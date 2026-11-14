package httpapi_test

import (
	"context"
	"net/http"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func storyPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/story" }

func getStory(c *testutil.Client, id uuid.UUID) httpapi.Story {
	var s httpapi.Story
	c.Get(storyPath(id), http.StatusOK, &s)
	return s
}

func chapterKinds(s httpapi.Story) []httpapi.StoryChapterKind {
	var out []httpapi.StoryChapterKind
	for _, ch := range s.Chapters {
		out = append(out, ch.Kind)
	}
	return out
}

func moments(s httpapi.Story, kind httpapi.StoryMomentKind) []httpapi.StoryMoment {
	var out []httpapi.StoryMoment
	for _, ch := range s.Chapters {
		for _, m := range ch.Moments {
			if m.Kind == kind {
				out = append(out, m)
			}
		}
	}
	return out
}

func TestStoryNeedsSessionAndOwnFamily(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	testutil.New(t).Get(storyPath(mom.Id), http.StatusUnauthorized, nil)
	other := testutil.New(t)
	other.StartDemo("pregnancy")
	other.Get(storyPath(mom.Id), http.StatusNotFound, nil)
}

func TestStoryOfAPregnancyAtWeek25(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	s := getStory(c, mom.Id)

	if got := chapterKinds(s); !slices.Equal(got, []httpapi.StoryChapterKind{httpapi.StoryChapterKindTrimester1, httpapi.StoryChapterKindTrimester2}) {
		t.Fatalf("chapters = %v, want the first two trimesters", got)
	}
	if last := s.Chapters[1]; !last.Current || last.EndsOn != nil || s.Chapters[0].Current || s.Chapters[0].EndsOn == nil {
		t.Errorf("the second trimester is the open, current chapter: %+v", last)
	}
	var weeks []int
	for _, m := range moments(s, httpapi.StoryMomentKindPregnancyWeek) {
		weeks = append(weeks, *m.Week)
		if m.Comparison == nil || m.Sources == nil || len(*m.Sources) == 0 {
			t.Errorf("week %d has no sourced size: %+v", *m.Week, m)
		}
		if m.On.After(testutil.Now) {
			t.Errorf("week %d is in the future: %s", *m.Week, m.On)
		}
	}
	if !slices.Equal(weeks, []int{8, 12, 16, 20, 24}) {
		t.Errorf("key weeks = %v, want 8 to 24", weeks)
	}
	// The OB visit two weeks ago is family-visible; next week's is not written yet.
	if v := moments(s, httpapi.StoryMomentKindAppointment); len(v) != 1 || v[0].PeopleIds[0] != mom.Id {
		t.Errorf("visits = %+v, want the past OB visit by Emily", v)
	}
	// Learning together: the names both like (the names quest seed adds Hazel), lessons read, the talk they had.
	if n := moments(s, httpapi.StoryMomentKindNamesLiked); len(n) != 1 || n[0].Title != "You both like Ada, June, Theo and Hazel" || len(n[0].PeopleIds) != 2 {
		t.Errorf("names = %+v", n)
	}
	if len(moments(s, httpapi.StoryMomentKindLessonRead)) == 0 || len(moments(s, httpapi.StoryMomentKindCoupleTalk)) != 1 {
		t.Errorf("want lessons read and one talk: %+v", s.Chapters[1].Moments)
	}
	if len(s.Next) == 0 || s.Next[0].Kind != httpapi.StoryMomentKindPregnancyWeek || s.Next[0].On == nil || s.Next[0].Title != "week 28 begins, about the size of an eggplant" {
		t.Errorf("next = %+v, want week 28 first", s.Next)
	}
	// Both parents read the same book.
	if js := getStory(c, jake.Id); len(js.Chapters) != len(s.Chapters) || len(moments(js, httpapi.StoryMomentKindPregnancyWeek)) != len(weeks) {
		t.Errorf("Jake's story differs: %v", chapterKinds(js))
	}

	// Three skipped weeks reach week 28: a new chapter and a new page.
	for range 3 {
		c.Post("/api/family/demo-time-skips", nil, http.StatusOK, nil)
	}
	later := getStory(c, mom.Id)
	if got := chapterKinds(later); len(got) != 3 || got[2] != httpapi.StoryChapterKindTrimester3 {
		t.Errorf("after the skips chapters = %v, want the third trimester", got)
	}
	if w := moments(later, httpapi.StoryMomentKindPregnancyWeek); *w[len(w)-1].Week != 28 {
		t.Errorf("after the skips the last week is %d, want 28", *w[len(w)-1].Week)
	}
}

func TestStoryJournalHoldsOnlySharedLines(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	c.Post(diaryPath(mom), entry("Emily's private worry.", "private"), http.StatusCreated, nil)
	c.Post(diaryPath(mom), entry("We heard the heartbeat together.", "partner"), http.StatusCreated, nil)
	c.Post(diaryPath(mom), entry("Only for the care team.", "care_team"), http.StatusCreated, nil)
	c.Post(diaryPath(jake), entry("Jake's private thought.", "private"), http.StatusCreated, nil)
	c.Post(diaryPath(jake), entry("Built the crib tonight.", "family"), http.StatusCreated, nil)

	for _, p := range []httpapi.Parent{mom, jake} {
		var quotes []string
		for _, m := range moments(getStory(c, p.Id), httpapi.StoryMomentKindJournal) {
			quotes = append(quotes, *m.Quote)
		}
		slices.Sort(quotes)
		// A private entry never appears, not even in its author's own book.
		if !slices.Equal(quotes, []string{"Built the crib tonight.", "We heard the heartbeat together."}) {
			t.Errorf("%s's book has journal lines %q", p.DisplayName, quotes)
		}
	}
	var audits int
	if err := c.Pool.QueryRow(context.Background(),
		`SELECT count(*) FROM audit_log WHERE actor_member_id = $1 AND action = 'read' AND entity = 'diary_entry'`, jake.Id).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if audits == 0 {
		t.Error("reading shared journal lines into the book is not audited")
	}

	// Caregivers get their own edition: no journal and no visits, ever.
	grandma, nanny := caregiver(t, fam, httpapi.CaregiverRoleGrandparent), caregiver(t, fam, httpapi.CaregiverRoleNanny)
	for _, cg := range []httpapi.Caregiver{grandma, nanny} {
		s := getStory(c, cg.Id)
		n := 0
		for _, k := range []httpapi.StoryMomentKind{httpapi.StoryMomentKindJournal, httpapi.StoryMomentKindAppointment, httpapi.StoryMomentKindLessonRead,
			httpapi.StoryMomentKindQuizCompared, httpapi.StoryMomentKindNamesLiked, httpapi.StoryMomentKindCoupleTalk} {
			n += len(moments(s, k))
		}
		if n != 0 {
			t.Errorf("%s sees %d parents' pages (journal, visits, lessons, names, talks)", cg.DisplayName, n)
		}
		if len(s.Next) == 0 || len(s.Chapters) == 0 {
			t.Errorf("%s gets an empty book: %+v", cg.DisplayName, s)
		}
	}
	// Pregnancy weeks follow pregnancy_updates: the grandmother has it, the nanny does not.
	if len(moments(getStory(c, grandma.Id), httpapi.StoryMomentKindPregnancyWeek)) == 0 {
		t.Error("the grandmother with pregnancy_updates sees no pregnancy weeks")
	}
	if n := len(moments(getStory(c, nanny.Id), httpapi.StoryMomentKindPregnancyWeek)); n != 0 {
		t.Errorf("the nanny sees %d pregnancy weeks", n)
	}
}

func TestStoryOfANewborn(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	aisha, marcus := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	s := getStory(c, aisha.Id)
	want := []httpapi.StoryChapterKind{httpapi.StoryChapterKindTrimester1, httpapi.StoryChapterKindTrimester2, httpapi.StoryChapterKindTrimester3, httpapi.StoryChapterKindNewborn}
	if got := chapterKinds(s); !slices.Equal(got, want) {
		t.Fatalf("chapters = %v, want %v", got, want)
	}
	if s.Chapters[3].Title != "Leo is home" || !s.Chapters[3].Current {
		t.Errorf("last chapter = %+v", s.Chapters[3])
	}
	home := moments(s, httpapi.StoryMomentKindBabyHome)
	if len(home) != 1 || home[0].On.Format("2006-01-02") != fam.Children[0].BirthDate.Format("2006-01-02") {
		t.Errorf("baby home = %+v", home)
	}
	if v := moments(s, httpapi.StoryMomentKindAppointment); len(v) != 1 || !slices.Contains(v[0].PeopleIds, marcus.Id) || !slices.Contains(v[0].PeopleIds, aisha.Id) {
		t.Errorf("visits = %+v, want the first checkup with both parents", v)
	}
	// The newborn seed also logs two weeks of history, so the total moves with
	// the seed; the 17 entries of the last days are the floor.
	if cl := moments(s, httpapi.StoryMomentKindCareLog); len(cl) != 1 || len(cl[0].PeopleIds) != 3 || *cl[0].Count < 17 {
		t.Errorf("care log = %+v, want at least the 17 recent entries by three people", cl)
	}
	if h := moments(s, httpapi.StoryMomentKindHandoff); len(h) != 1 || h[0].PeopleIds[0] != aisha.Id {
		t.Errorf("handoffs = %+v", h)
	}
	if len(moments(s, httpapi.StoryMomentKindVaccines)) != 1 || len(moments(s, httpapi.StoryMomentKindStageLine)) < 2 {
		t.Errorf("want the birth dose and the age lines passed: %+v", s.Chapters[3].Moments)
	}
	for _, m := range moments(s, httpapi.StoryMomentKindStageLine) {
		if m.Sources == nil || len(*m.Sources) == 0 || len(m.PeopleIds) != 0 {
			t.Errorf("age line %q needs sources and no people", m.Title)
		}
	}

	// The nanny's edition: the arrival, the age lines and her own handoffs (none), no visits or vaccines.
	ns := getStory(c, caregiver(t, fam, httpapi.CaregiverRoleNanny).Id)
	if len(moments(ns, httpapi.StoryMomentKindAppointment))+len(moments(ns, httpapi.StoryMomentKindVaccines))+len(moments(ns, httpapi.StoryMomentKindHandoff))+len(moments(ns, httpapi.StoryMomentKindPregnancyWeek)) != 0 {
		t.Errorf("the nanny's book holds parents' or other people's pages: %+v", ns)
	}
	if len(moments(ns, httpapi.StoryMomentKindBabyHome)) != 1 {
		t.Error("the nanny's book misses the arrival")
	}
	// The grandmother took the handoff, so it is in her book.
	if len(moments(getStory(c, caregiver(t, fam, httpapi.CaregiverRoleGrandparent).Id), httpapi.StoryMomentKindHandoff)) != 1 {
		t.Error("the grandmother's book misses her handoff")
	}
}

func TestStoryOfAPreschooler(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("preschool")
	s := getStory(c, testutil.Parent(t, fam, httpapi.ParentRolePartner).Id)
	want := []httpapi.StoryChapterKind{httpapi.StoryChapterKindNewborn, httpapi.StoryChapterKindFirstYear, httpapi.StoryChapterKindToddler, httpapi.StoryChapterKindPreschool}
	if got := chapterKinds(s); !slices.Equal(got, want) {
		t.Fatalf("chapters = %v, want %v (no due date, so the book starts at the birth)", got, want)
	}
	for _, ch := range s.Chapters {
		if len(ch.Moments) == 0 {
			t.Errorf("chapter %s is empty", ch.Kind)
		}
	}
	if len(moments(s, httpapi.StoryMomentKindVaccines)) < 5 {
		t.Errorf("vaccine days = %d", len(moments(s, httpapi.StoryMomentKindVaccines)))
	}
}

func TestStoryOfAPlanningFamilyInvites(t *testing.T) {
	c := testutil.New(t)
	s := getStory(c, testutil.Parent(t, c.StartDemo("planning"), httpapi.ParentRoleMother).Id)
	if got := chapterKinds(s); !slices.Equal(got, []httpapi.StoryChapterKind{httpapi.StoryChapterKindGettingReady}) || !s.Chapters[0].Current {
		t.Fatalf("chapters = %v", got)
	}
	if len(s.Chapters[0].Moments) == 0 || len(moments(s, httpapi.StoryMomentKindNamesLiked)) != 1 {
		t.Errorf("the planning book opens with what they already did: %+v", s.Chapters[0].Moments)
	}
	if len(s.Next) < 2 {
		t.Errorf("an early family gets invitations for the next pages: %+v", s.Next)
	}
}
