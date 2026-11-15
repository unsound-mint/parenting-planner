package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func memberPath(id uuid.UUID) string { return "/api/members/" + id.String() }

func findPath(t *testing.T, list httpapi.LearningPathList, id string) httpapi.LearningPath {
	t.Helper()
	for _, p := range list.Items {
		if p.Id == id {
			return p
		}
	}
	t.Fatalf("no path %s", id)
	return httpapi.LearningPath{}
}

func findLesson(t *testing.T, list httpapi.LearningPathList, id string) httpapi.Lesson {
	t.Helper()
	for _, p := range list.Items {
		for _, l := range p.Lessons {
			if l.Id == id {
				return l
			}
		}
	}
	t.Fatalf("no lesson %s", id)
	return httpapi.Lesson{}
}

func findQuestion(t *testing.T, list httpapi.LearningPathList, id string) httpapi.QuizQuestion {
	t.Helper()
	for _, p := range list.Items {
		for _, l := range p.Lessons {
			for _, q := range l.Quiz {
				if q.Id == id {
					return q
				}
			}
		}
	}
	t.Fatalf("no question %s", id)
	return httpapi.QuizQuestion{}
}

func TestLearningPathsShowBothParentsProgressAtWeek25(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var list httpapi.LearningPathList
	c.Get(memberPath(mom.Id)+"/learning-paths", http.StatusOK, &list)
	if list.Week == nil || *list.Week != 25 || list.Stage != httpapi.StagePregnancy || len(list.Items) < 8 {
		t.Fatalf("week %v, stage %s, %d paths", list.Week, list.Stage, len(list.Items))
	}
	p := findPath(t, list, "your-pregnancy")
	if len(p.Progress) != 2 || p.Progress[0].MemberId != mom.Id || p.Progress[0].Finished != 3 || p.Progress[0].Started != 1 ||
		p.Progress[1].MemberId != dad.Id || p.Progress[1].Finished != 3 {
		t.Errorf("your-pregnancy progress = %+v", p.Progress)
	}
	pain := findLesson(t, list, "pain-relief")
	if pain.Timing != httpapi.LessonTimingUpcoming || *pain.WeekFrom != 28 || pain.TalkPrompt == nil {
		t.Errorf("pain-relief timing %s", pain.Timing)
	}
	if len(pain.Reads) != 2 || pain.Reads[0].MemberId != mom.Id || pain.Reads[0].FinishedAt != nil || pain.Reads[1].FinishedAt == nil {
		t.Errorf("pain-relief reads = %+v", pain.Reads)
	}
	labor := findLesson(t, list, "how-labor-starts")
	if *labor.WeekFrom != 30 || !strings.Contains(labor.Source.Url, "nichd.nih.gov") {
		t.Errorf("how-labor-starts from week %d, source %s", *labor.WeekFrom, labor.Source.Url)
	}
	if l := findLesson(t, list, "warning-signs"); !l.UrgentHelpLink || l.Timing != httpapi.LessonTimingNow {
		t.Errorf("warning-signs urgent %v timing %s", l.UrgentHelpLink, l.Timing)
	}
	if l := findLesson(t, list, "show-up"); len(l.Audience) != 1 || l.Audience[0] != httpapi.GuideAudiencePartner {
		t.Errorf("show-up is for partners and still listed for the mother: %+v", l.Audience)
	}
}

// The quiz never gives the answer away: Jake's choice, the right choice and
// the explanation show to Emily only after she answered.
func TestQuizRevealsThePartnersAnswerOnlyAfterYouAnswer(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var list httpapi.LearningPathList
	c.Get(memberPath(mom.Id)+"/learning-paths", http.StatusOK, &list)
	q := findQuestion(t, list, "pain-relief-q2")
	if len(q.Answers) != 1 || q.Answers[0].MemberId != dad.Id || q.Answers[0].ChoiceId != nil || q.Answers[0].Correct != nil ||
		q.CorrectChoiceId != nil || q.Explanation != nil {
		t.Fatalf("before answering: %+v", q)
	}

	var res httpapi.QuizResult
	c.Post(memberPath(mom.Id)+"/quiz-answers", map[string]any{"questionId": "pain-relief-q2", "choiceId": "b"}, http.StatusCreated, &res)
	if !res.Correct || res.CorrectChoiceId != "b" || res.Explanation == "" || res.Source.Url == "" ||
		res.PartnerAnswer == nil || *res.PartnerAnswer.ChoiceId != "a" || *res.PartnerAnswer.Correct {
		t.Errorf("result = %+v", res)
	}
	c.Get(memberPath(mom.Id)+"/learning-paths", http.StatusOK, &list)
	q = findQuestion(t, list, "pain-relief-q2")
	if len(q.Answers) != 2 || q.Answers[0].MemberId != mom.Id || *q.Answers[1].ChoiceId != "a" || q.CorrectChoiceId == nil {
		t.Errorf("after answering: %+v", q)
	}

	// Jake answered first, so he now sees Emily's choice too.
	c.Get(memberPath(dad.Id)+"/learning-paths", http.StatusOK, &list)
	if q := findQuestion(t, list, "pain-relief-q2"); len(q.Answers) != 2 || q.Answers[1].ChoiceId == nil || *q.Answers[1].ChoiceId != "b" {
		t.Errorf("Jake's view: %+v", q.Answers)
	}

	answer := func(question, choice string, status int) {
		t.Helper()
		c.Post(memberPath(mom.Id)+"/quiz-answers", map[string]any{"questionId": question, "choiceId": choice}, status, nil)
	}
	answer("pain-relief-q2", "a", http.StatusConflict)     // one answer each
	answer("pain-relief-q1", "z", http.StatusBadRequest)   // not a choice
	answer("no-such-lesson-q1", "a", http.StatusNotFound)  // not in the catalog
	answer("how-labor-starts-q1", "a", http.StatusCreated) // a later lesson can be read ahead
	c.Put(memberPath(mom.Id)+"/lesson-reads/how-labor-starts", map[string]any{"finished": true}, http.StatusOK, nil)
}

func TestLessonReadsStartFinishAndUndo(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	path := memberPath(mom.Id) + "/lesson-reads/"
	var r httpapi.LessonRead
	c.Put(path+"warning-signs", map[string]any{"finished": true}, http.StatusOK, &r)
	if r.FinishedAt == nil || !r.StartedAt.Before(*r.FinishedAt) {
		t.Errorf("finish keeps the seeded start and sets a finish: %+v", r)
	}
	r = httpapi.LessonRead{}
	c.Put(path+"warning-signs", map[string]any{"finished": false}, http.StatusOK, &r)
	if r.FinishedAt != nil || r.StartedAt.IsZero() {
		t.Errorf("finished false must clear the finish: %+v", r)
	}
	c.Put(path+"cesarean", map[string]any{"finished": false}, http.StatusOK, nil) // a later lesson can be read ahead
	c.Put(path+"nope", map[string]any{"finished": true}, http.StatusNotFound, nil)

	var list httpapi.LearningPathList
	c.Get(memberPath(mom.Id)+"/learning-paths", http.StatusOK, &list)
	if p := findPath(t, list, "your-pregnancy"); p.Progress[0].Finished != 3 || p.Progress[0].Started != 1 {
		t.Errorf("progress after undo = %+v", p.Progress[0])
	}
}

func TestTogetherNudgesFromThePartnersRealActivity(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var card httpapi.Together
	c.Get(memberPath(mom.Id)+"/together", http.StatusOK, &card)
	if card.Nudge == nil || card.Nudge.MemberId != dad.Id || card.Nudge.Kind != httpapi.LessonFinished ||
		card.Nudge.Text != `Jake finished "Pain relief: the options" yesterday. Ask what stood out.` {
		t.Fatalf("Emily's nudge = %+v", card.Nudge)
	}
	if len(card.Prompts) < 3 || card.Prompts[0].Id != "lesson:pain-relief" {
		t.Fatalf("the lesson Jake just finished leads the prompts: %+v", card.Prompts)
	}
	last := card.Prompts[len(card.Prompts)-1]
	if last.Id != "p08" || last.TalkedAt == nil || *last.TalkedBy != dad.Id {
		t.Errorf("talked-about prompt goes last: %+v", last)
	}

	// Emily finished nothing this week but added Rose on Wednesday (Nov 11).
	c.Get(memberPath(dad.Id)+"/together", http.StatusOK, &card)
	if card.Nudge == nil || card.Nudge.Kind != httpapi.NameAdded || card.Nudge.Text != "Emily added Rose to your name list on Wednesday." {
		t.Errorf("Jake's nudge = %+v", card.Nudge)
	}

	// "We talked about it" is one shared record; the first one wins.
	next := card.Prompts[0].Id
	var talk httpapi.CoupleTalk
	c.Post(memberPath(dad.Id)+"/couple-talks", map[string]any{"promptId": next}, http.StatusCreated, &talk)
	c.Post(memberPath(mom.Id)+"/couple-talks", map[string]any{"promptId": next}, http.StatusCreated, &talk)
	if talk.TalkedBy != dad.Id {
		t.Errorf("second mark replaced the first: %+v", talk)
	}
	c.Get(memberPath(mom.Id)+"/together", http.StatusOK, &card)
	if card.Prompts[0].Id == next {
		t.Errorf("talked prompt %s still leads: %+v", next, card.Prompts)
	}
	for _, p := range card.Prompts {
		if p.Id == next && (p.TalkedAt == nil || *p.TalkedBy != dad.Id) {
			t.Errorf("Emily does not see Jake's mark on %s: %+v", next, p)
		}
	}
	c.Post(memberPath(mom.Id)+"/couple-talks", map[string]any{"promptId": "p99"}, http.StatusNotFound, nil)

	// A talk on a lesson prompt shows on the lesson too, so the button survives a reload.
	c.Post(memberPath(dad.Id)+"/couple-talks", map[string]any{"promptId": "lesson:pain-relief"}, http.StatusCreated, nil)
	var list httpapi.LearningPathList
	c.Get(memberPath(mom.Id)+"/learning-paths", http.StatusOK, &list)
	for _, p := range list.Items {
		for _, l := range p.Lessons {
			if (l.Id == "pain-relief") != (l.TalkedAt != nil) {
				t.Errorf("lesson %s talkedAt = %v", l.Id, l.TalkedAt)
			}
		}
	}
}

func TestBabyNamesAreSharedWithLikesPerParent(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var list httpapi.BabyNameList
	c.Get(memberPath(mom.Id)+"/baby-names", http.StatusOK, &list)
	var got []string
	for _, n := range list.Items {
		got = append(got, n.Name)
	}
	// Hazel is a names quest match (both loved it in the deck).
	if strings.Join(got, ",") != "Hazel,Theo,June,Ada,Miles,Rose" || !list.Items[0].BothLike || list.Items[4].BothLike {
		t.Errorf("names = %v", got)
	}

	var n httpapi.BabyName
	c.Post(memberPath(mom.Id)+"/baby-names", map[string]any{"name": "  Luna "}, http.StatusCreated, &n)
	if n.Name != "Luna" || n.AddedBy != mom.Id || len(n.LikedBy) != 1 || n.BothLike {
		t.Errorf("new name = %+v", n)
	}
	c.Post(memberPath(dad.Id)+"/baby-names", map[string]any{"name": "luna"}, http.StatusConflict, nil)
	c.Post(memberPath(dad.Id)+"/baby-names", map[string]any{"name": "   "}, http.StatusBadRequest, nil)
	like := memberPath(dad.Id) + "/baby-names/" + n.Id.String() + "/like"
	c.Put(like, nil, http.StatusOK, &n)
	c.Put(like, nil, http.StatusOK, &n) // idempotent
	if !n.BothLike || len(n.LikedBy) != 2 {
		t.Errorf("after Jake likes it: %+v", n)
	}
	c.Delete(like, http.StatusOK, &n)
	if n.BothLike || len(n.LikedBy) != 1 || n.LikedBy[0] != mom.Id {
		t.Errorf("after Jake takes it back: %+v", n)
	}
	c.Put(memberPath(dad.Id)+"/baby-names/"+uuid.NewString()+"/like", nil, http.StatusNotFound, nil)
}

// Caregivers never reach learning, the couple card or names, and another
// family's session sees none of it.
func TestLearningIsForParentsOfThisFamilyOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var names httpapi.BabyNameList
	c.Get(memberPath(mom.Id)+"/baby-names", http.StatusOK, &names)
	nameLike := "/baby-names/" + names.Items[0].Id.String() + "/like"
	calls := func(m string, status int) {
		t.Helper()
		c.Get(m+"/learning-paths", status, nil)
		c.Put(m+"/lesson-reads/warning-signs", map[string]any{"finished": true}, status, nil)
		c.Post(m+"/quiz-answers", map[string]any{"questionId": "pain-relief-q1", "choiceId": "b"}, status, nil)
		c.Get(m+"/together", status, nil)
		c.Post(m+"/couple-talks", map[string]any{"promptId": "p17"}, status, nil)
		c.Get(m+"/baby-names", status, nil)
		c.Post(m+"/baby-names", map[string]any{"name": "Iris"}, status, nil)
		c.Put(m+nameLike, nil, status, nil)
		c.Delete(m+nameLike, status, nil)
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
	c.Put(memberPath(otherMom.Id)+nameLike, nil, http.StatusNotFound, nil) // a name of the first family
}

func TestLearningForOtherStages(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	aisha := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var list httpapi.LearningPathList
	c.Get(memberPath(aisha.Id)+"/learning-paths", http.StatusOK, &list)
	var ids []string
	for _, p := range list.Items {
		ids = append(ids, p.Id)
		for _, l := range p.Lessons {
			if l.Timing != httpapi.LessonTimingNow || l.WeekFrom != nil {
				t.Errorf("after birth %s must be open with no weeks", l.Id)
			}
		}
	}
	// Paths from later *_paths.json files follow the core ones.
	if list.Week != nil || !strings.HasPrefix(strings.Join(ids, ","), "feeding,first-weeks,couple,money-leave,mental-health") {
		t.Errorf("newborn paths = %v, week %v", ids, list.Week)
	}
	var card httpapi.Together
	c.Get(memberPath(aisha.Id)+"/together", http.StatusOK, &card)
	if card.Nudge == nil || !strings.HasPrefix(card.Nudge.Text, `Marcus finished "When the crying feels endless" on Thursday`) || len(card.Prompts) == 0 {
		t.Errorf("newborn card = %+v", card)
	}

	planning := testutil.Parent(t, c.StartDemo("planning"), httpapi.ParentRoleMother)
	c.Get(memberPath(planning.Id)+"/learning-paths", http.StatusOK, &list)
	if len(list.Items) < 3 || list.Items[0].Id != "couple" || list.Items[1].Id != "money-leave" || list.Items[2].Id != "mental-health" {
		t.Errorf("planning gets couple, money and mental health paths, got %d", len(list.Items))
	}
}
