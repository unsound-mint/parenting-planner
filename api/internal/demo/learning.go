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

// learnSwipe is a names quest answer. A name both parents love is seeded as a
// match: on the shared list, liked by both.
type learnSwipe struct {
	who     who
	name    string
	verdict string
	day     int
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
	// The names quest: the lists the couple picked and each parent's swipes.
	nameLists []string
	swipes    []learnSwipe
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
		// Names quest: Hazel is a match from the deck (four matches with Ada,
		// June and Theo, one short of the final round). Iris, Finn and Eleanor
		// are love/maybe pairs to talk about. Jake loved Eloise, Rowan, Willow,
		// Leo and Grace, which Emily has not seen yet: they lead her deck, so a
		// match can happen in the demo.
		nameLists: []string{"english", "irish", "french", "vintage"},
		swipes: []learnSwipe{
			{mother, "Hazel", "love", -9}, {mother, "Iris", "love", -9}, {mother, "Maeve", "maybe", -8},
			{mother, "Henry", "love", -8}, {mother, "Josephine", "no", -8}, {mother, "Claire", "maybe", -7},
			{mother, "Finn", "love", -7}, {mother, "Violet", "love", -6}, {mother, "Charlotte", "no", -6},
			{mother, "Connor", "no", -6}, {mother, "Audrey", "maybe", -5}, {mother, "Eleanor", "love", -5},
			{partner, "Hazel", "love", -4}, {partner, "Iris", "maybe", -4}, {partner, "Henry", "no", -4},
			{partner, "Finn", "maybe", -3}, {partner, "Eloise", "love", -3}, {partner, "Rowan", "love", -3},
			{partner, "Violet", "no", -2}, {partner, "Willow", "love", -2}, {partner, "Sophie", "maybe", -2},
			{partner, "Leo", "love", -1}, {partner, "Maeve", "no", -1}, {partner, "Grace", "love", -1},
			{partner, "Eleanor", "maybe", -1},
		},
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
		// Names quest: River is a match from the deck (two with Nora); Camila,
		// Mateo and Willow are love/maybe pairs.
		nameLists: []string{"latino", "english", "neutral"},
		swipes: []learnSwipe{
			{mother, "Camila", "love", -6}, {mother, "River", "love", -6}, {mother, "Mateo", "maybe", -5},
			{mother, "Sienna", "no", -5}, {mother, "Daisy", "love", -5}, {mother, "Santiago", "no", -4},
			{mother, "Valentina", "maybe", -4}, {mother, "Willow", "love", -4},
			{partner, "River", "love", -2}, {partner, "Camila", "maybe", -2}, {partner, "Daisy", "no", -2},
			{partner, "Mateo", "love", -1}, {partner, "Sienna", "love", -1}, {partner, "Elena", "love", -1},
			{partner, "Parker", "no", -1}, {partner, "Willow", "maybe", -1},
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
	// Rachel and Tom, Ava at 4: a weekly check-in and calmer dinners.
	Preschool: {
		reads: []learnRead{
			{mother, "check-in-habit", -6, -6},
			{partner, "added-sugar-detectives", -3, -3},
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
	if len(story.nameLists) > 0 {
		if err := q.SetNamesQuestLists(ctx, store.SetNamesQuestListsParams{FamilyID: fam, Lists: story.nameLists, UpdatedBy: mom, UpdatedAt: at(-10, 0)}); err != nil {
			return err
		}
	}
	loved := map[string][]learnSwipe{}
	for _, sw := range story.swipes {
		if err := q.UpsertNameSwipe(ctx, store.UpsertNameSwipeParams{FamilyID: fam, MemberID: id(sw.who), Name: sw.name, Verdict: sw.verdict, SwipedAt: at(sw.day, 70)}); err != nil {
			return err
		}
		if sw.verdict == "love" {
			loved[sw.name] = append(loved[sw.name], sw)
		}
	}
	for _, sw := range story.swipes {
		both := loved[sw.name]
		if len(both) != 2 || both[1] != sw {
			continue
		}
		// The second love makes the match, as together.Swipe does.
		row, err := q.CreateBabyName(ctx, store.CreateBabyNameParams{FamilyID: fam, Name: sw.name, AddedBy: id(sw.who), CreatedAt: at(sw.day, 70)})
		if err != nil {
			return err
		}
		for _, l := range both {
			if err := q.LikeBabyName(ctx, store.LikeBabyNameParams{MemberID: id(l.who), CreatedAt: at(sw.day, 70), NameID: row.ID, FamilyID: fam}); err != nil {
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
