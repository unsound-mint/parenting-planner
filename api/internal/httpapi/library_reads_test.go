package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Read and saved state is per parent: the partner's list never shows it.
func TestLibraryReadAndSaveArePerParent(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	yes, no := true, false
	var r httpapi.LibraryRead
	c.Put(memberPath(mom.Id)+"/library-reads/caffeine-in-pregnancy", httpapi.LibraryReadInput{Read: &yes}, http.StatusOK, &r)
	if r.ReadAt == nil || r.SavedAt != nil {
		t.Fatalf("after read: %+v", r)
	}
	first := *r.ReadAt
	c.Put(memberPath(mom.Id)+"/library-reads/caffeine-in-pregnancy", httpapi.LibraryReadInput{Saved: &yes}, http.StatusOK, &r)
	if r.ReadAt == nil || !r.ReadAt.Equal(first) || r.SavedAt == nil {
		t.Fatalf("save must keep the first read: %+v", r)
	}
	state := func(memberID uuid.UUID) (read, saved bool) {
		var l httpapi.LibraryTopicList
		c.Get(memberPath(memberID)+"/library-topics", http.StatusOK, &l)
		for _, it := range l.Items {
			if it.Id == "caffeine-in-pregnancy" {
				return it.ReadAt != nil, it.SavedAt != nil
			}
		}
		t.Fatal("topic missing")
		return
	}
	if read, saved := state(mom.Id); !read || !saved {
		t.Errorf("mother sees read=%v saved=%v", read, saved)
	}
	if read, saved := state(partner.Id); read || saved {
		t.Errorf("partner sees the mother's state: read=%v saved=%v", read, saved)
	}
	c.Put(memberPath(mom.Id)+"/library-reads/caffeine-in-pregnancy", httpapi.LibraryReadInput{Saved: &no}, http.StatusOK, &r)
	if r.SavedAt != nil || r.ReadAt == nil {
		t.Errorf("unsave: %+v", r)
	}
	c.Put(memberPath(mom.Id)+"/library-reads/no-such-topic", httpapi.LibraryReadInput{Read: &yes}, http.StatusNotFound, nil)
	c.Put(memberPath(mom.Id)+"/library-reads/caffeine-in-pregnancy", map[string]any{}, http.StatusBadRequest, nil)
}

// A retake is graded on the server and listed for that parent only.
func TestQuizAttemptIsGradedOnTheServer(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var list httpapi.LearningPathList
	c.Get(memberPath(mom.Id)+"/learning-paths", http.StatusOK, &list)
	var deck httpapi.LearningPath
	var qs []httpapi.QuizQuestion
	for _, p := range list.Items {
		for _, l := range p.Lessons {
			qs = append(qs, l.Quiz...)
		}
		if len(qs) >= 2 {
			deck = p
			break
		}
		qs = nil
	}
	if len(qs) < 2 {
		t.Fatal("no deck with two questions")
	}
	right := map[string]string{}
	for _, p := range content.AllLearnPaths() {
		for _, l := range p.Lessons {
			for _, q := range l.Quiz {
				right[q.ID] = q.CorrectChoiceID
			}
		}
	}
	wrong := func(q httpapi.QuizQuestion) string {
		for _, ch := range q.Choices {
			if ch.Id != right[q.Id] {
				return ch.Id
			}
		}
		return ""
	}
	type ans = struct {
		ChoiceId   string `json:"choiceId"`
		QuestionId string `json:"questionId"`
	}
	in := httpapi.QuizAttemptInput{DeckId: deck.Id, Answers: []ans{{QuestionId: qs[0].Id, ChoiceId: right[qs[0].Id]}, {QuestionId: qs[1].Id, ChoiceId: wrong(qs[1])}}}
	var a httpapi.QuizAttempt
	c.Post(memberPath(mom.Id)+"/quiz-attempts", in, http.StatusCreated, &a)
	if a.Score != 1 || a.Total != 2 || len(a.Missed) != 1 || a.Missed[0] != qs[1].Id {
		t.Errorf("attempt %+v", a)
	}
	var mine, theirs httpapi.QuizAttemptList
	c.Get(memberPath(mom.Id)+"/quiz-attempts", http.StatusOK, &mine)
	c.Get(memberPath(partner.Id)+"/quiz-attempts", http.StatusOK, &theirs)
	if len(mine.Items) != 1 || len(theirs.Items) != 0 {
		t.Errorf("mother has %d attempts, partner %d", len(mine.Items), len(theirs.Items))
	}
	c.Post(memberPath(mom.Id)+"/quiz-attempts", httpapi.QuizAttemptInput{DeckId: "no-such-deck", Answers: in.Answers}, http.StatusNotFound, nil)
	bad := httpapi.QuizAttemptInput{DeckId: deck.Id, Answers: []ans{{QuestionId: qs[0].Id, ChoiceId: "zz"}}}
	c.Post(memberPath(mom.Id)+"/quiz-attempts", bad, http.StatusBadRequest, nil)
}
