package demo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Learning progress, quiz answers, couple talks and names for each demo family,
// so Learn and the "Tonight, together" card open mid-story. Days are relative
// to today (negative is the past) at a fixed evening hour, never later than
// now. The pregnancy story is the one the web preview mocks tell
// (web/src/lib/mock/fixtures/learn.ts): keep the two in step.

type who int

const (
	mother who = iota
	partner
)

type learnRead struct {
	who      who
	lesson   string
	started  int
	finished int // 0 = not finished
}

type learnAnswer struct {
	who      who
	question string
	choice   string
	day      int
}

type learnName struct {
	name   string
	by     who
	likers []who
	day    int
}

type learnTalk struct {
	prompt string
	by     who
	day    int
}

type learnStory struct {
	reads   []learnRead
	answers []learnAnswer
	names   []learnName
	talks   []learnTalk
}

var learnStories = map[Template]learnStory{
	// Emily and Jake, week 25. Jake finished "Pain relief: the options"
	// yesterday and answered its quiz; Emily started it. Ada, June and Theo
	// are liked by both.
	Pregnancy: {
		reads: []learnRead{
			{mother, "visit-rhythm", -62, -62},
			{mother, "everyday-habits", -46, -45},
			{mother, "first-movements", -10, -10},
			{mother, "warning-signs", -2, 0},
			{mother, "research-on-couples", -30, -30},
			{mother, "whats-common", -20, -20},
			{mother, "pain-relief", -1, 0},
			{partner, "visit-rhythm", -50, -50},
			{partner, "everyday-habits", -40, -40},
			{partner, "first-movements", -6, -6},
			{partner, "show-up", -35, -35},
			{partner, "partner-mental-health", -4, -4},
			{partner, "research-on-couples", -28, -28},
			{partner, "fmla-basics", -14, -14},
			{partner, "pain-relief", -1, -1},
		},
		answers: []learnAnswer{
			{partner, "pain-relief-q1", "b", -1},
			{partner, "pain-relief-q2", "a", -1},
			{partner, "pain-relief-q3", "a", -1},
		},
		names: []learnName{
			{"Ada", mother, []who{mother, partner}, -20},
			{"June", partner, []who{partner, mother}, -12},
			{"Theo", mother, []who{mother, partner}, -5},
			{"Rose", mother, []who{mother}, -3},
			{"Miles", partner, []who{partner}, -2},
		},
		talks: []learnTalk{{"p08", partner, -6}},
	},
	// Maya and Daniel, planning: dreaming and getting the paperwork straight.
	Planning: {
		reads: []learnRead{
			{mother, "research-on-couples", -9, -9},
			{mother, "whats-common", -4, -4},
			{partner, "fmla-basics", -2, -2},
			{partner, "research-on-couples", -1, 0},
			{mother, "folate-you-can-taste", -8, -8},
			{partner, "plate-you-both-like", -6, -6},
		},
		names: []learnName{
			{"Nora", mother, []who{mother, partner}, -15},
			{"Felix", partner, []who{partner}, -3},
		},
	},
	// Aisha and Marcus, Leo at 7 weeks: feeding, sleep and the crying.
	Newborn: {
		reads: []learnRead{
			{mother, "reading-cues", -12, -12},
			{mother, "breastfeeding-rhythm", -10, -10},
			{mother, "safe-sleep", -8, -8},
			{mother, "baby-blues", -3, -3},
			{partner, "safe-sleep", -9, -9},
			{partner, "feelings-both-ways", -5, -5},
			{partner, "insurance-newborn", -6, -6},
			{partner, "crying", -2, -2},
			{partner, "formula-basics", -1, 0},
		},
		answers: []learnAnswer{
			{partner, "crying-q1", "a", -2},
			{partner, "crying-q2", "a", -2},
		},
		talks: []learnTalk{{"lesson:safe-sleep", mother, -7}},
	},
	// Rachel and Tom, Ava at 4: keeping the couple going.
	Preschool: {
		reads: []learnRead{
			{mother, "check-in-habit", -6, -6},
			{partner, "us-time", -3, -3},
			{mother, "picky-is-normal", -10, -10},
		},
	},
}

// seedLearning writes the template's learning story for the two parents.
func seedLearning(ctx context.Context, q *store.Queries, t Template, fam, mom, dad uuid.UUID, today time.Time) error {
	story, ok := learnStories[t]
	if !ok {
		return nil
	}
	id := func(w who) uuid.UUID {
		if w == mother {
			return mom
		}
		return dad
	}
	at := func(day int, mins int) time.Time {
		return today.AddDate(0, 0, day).Add(20*time.Hour + time.Duration(mins)*time.Minute)
	}
	for _, r := range story.reads {
		if _, err := q.StartLessonRead(ctx, store.StartLessonReadParams{
			FamilyID: fam, MemberID: id(r.who), LessonID: r.lesson, At: at(r.started, 30), Finished: false,
		}); err != nil {
			return err
		}
		if r.finished != 0 {
			if _, err := q.StartLessonRead(ctx, store.StartLessonReadParams{
				FamilyID: fam, MemberID: id(r.who), LessonID: r.lesson, At: at(r.finished, 45), Finished: true,
			}); err != nil {
				return err
			}
		}
	}
	for _, a := range story.answers {
		if _, err := q.CreateQuizAnswer(ctx, store.CreateQuizAnswerParams{
			FamilyID: fam, MemberID: id(a.who), QuestionID: a.question, ChoiceID: a.choice, AnsweredAt: at(a.day, 50),
		}); err != nil {
			return err
		}
	}
	for _, n := range story.names {
		row, err := q.CreateBabyName(ctx, store.CreateBabyNameParams{FamilyID: fam, Name: n.name, AddedBy: id(n.by), CreatedAt: at(n.day, 60)})
		if err != nil {
			return err
		}
		for i, w := range n.likers {
			if err := q.LikeBabyName(ctx, store.LikeBabyNameParams{
				MemberID: id(w), CreatedAt: at(n.day, 60+i), NameID: row.ID, FamilyID: fam,
			}); err != nil {
				return err
			}
		}
	}
	for _, t := range story.talks {
		if _, err := q.CreateCoupleTalk(ctx, store.CreateCoupleTalkParams{FamilyID: fam, PromptID: t.prompt, TalkedBy: id(t.by), TalkedAt: at(t.day, 90)}); err != nil {
			return err
		}
	}
	return nil
}
