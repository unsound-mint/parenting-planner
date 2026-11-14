package content

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"
)

// learn_paths.json is the learning catalog: 8 paths, 32 lessons and their
// quizzes. Lesson bodies are our own plain-language writing from the cited
// page; every source was opened on its checkedAt date and numbers were checked
// against the page text. The labor lesson cites NICHD only: the MedlinePlus
// labor page is A.D.A.M. content that forbids derivative works.
// talk_prompts.json is the couple and journal prompt pool by pregnancy week.
// The prompts make no health claims, so they cite nothing.
//
//go:embed learn_paths.json
var learnPathsJSON []byte

//go:embed talk_prompts.json
var talkPromptsJSON []byte

// ReadAheadWeeks is how long before its best-read window a lesson opens.
const ReadAheadWeeks = 4

// LearnPath is one learning path in reading order.
type LearnPath struct {
	ID, Title, Why string
	// Stages the path is offered in. Outside pregnancy every lesson is open.
	Stages  []string
	Lessons []Lesson
}

// Lesson is a short read with a quiz.
type Lesson struct {
	ID, PathID, Title string
	Body              []string
	Minutes           int
	// WeekFrom and WeekTo are the best-read window in gestational weeks.
	WeekFrom, WeekTo int
	// Audience is "mother" and "partner", or "partner" alone.
	Audience []string
	// Stages the lesson is offered in: the path's, or fewer when the text
	// only fits some of them (a night plan "to review after the birth" is
	// not for parents of a four-year-old).
	Stages         []string
	Source         Source
	ExtraSources   []Source
	TalkPrompt     string
	UrgentHelpLink bool
	Quiz           []Question
}

// UnlocksAtWeek is the first week a lesson can be opened in pregnancy.
func (l Lesson) UnlocksAtWeek() int { return max(MinWeek, l.WeekFrom-ReadAheadWeeks) }

// Timing is where a lesson's window sits relative to the family.
type Timing string

const (
	TimingUpcoming Timing = "upcoming"
	TimingNow      Timing = "now"
	TimingPast     Timing = "past"
)

// LessonState is a lesson as seen by one family.
type LessonState struct {
	Timing Timing
	Locked bool
	// InPregnancy is false outside pregnancy, where weeks do not apply.
	InPregnancy bool
}

// StateOf places the lesson against the family's stage and week. Outside
// pregnancy (or without a week) every lesson is open and timing is now.
func (l Lesson) StateOf(s State) LessonState {
	if s.Stage != "pregnancy" || !s.HasWeek {
		return LessonState{Timing: TimingNow}
	}
	st := LessonState{Timing: TimingNow, InPregnancy: true, Locked: s.Week < l.UnlocksAtWeek()}
	switch {
	case s.Week < l.WeekFrom:
		st.Timing = TimingUpcoming
	case s.Week > l.WeekTo:
		st.Timing = TimingPast
	}
	return st
}

// Question is one quiz question. Choice ids are a, b, c in catalog order and
// the question id is the lesson id plus its position, so stored answers stay
// valid as long as questions are only appended.
type Question struct {
	ID, LessonID, Prompt string
	Choices              []Choice
	CorrectChoiceID      string
	Explanation          string
}

type Choice struct{ ID, Text string }

// TalkPrompt is a couple prompt from the pool.
type TalkPrompt struct {
	ID, Text         string
	WeekFrom, WeekTo int
}

var (
	learnPaths            []LearnPath
	lessonsByID           map[string]Lesson
	questionsByID         map[string]Question
	coupleTalkPrompts     []TalkPrompt
	coupleTalkPromptsByID map[string]TalkPrompt
)

func init() {
	learnPaths, coupleTalkPrompts = loadLearn()
	lessonsByID, questionsByID = map[string]Lesson{}, map[string]Question{}
	for _, p := range learnPaths {
		for _, l := range p.Lessons {
			lessonsByID[l.ID] = l
			for _, q := range l.Quiz {
				questionsByID[q.ID] = q
			}
		}
	}
	coupleTalkPromptsByID = map[string]TalkPrompt{}
	for _, p := range coupleTalkPrompts {
		coupleTalkPromptsByID[p.ID] = p
	}
}

const choiceIDs = "abcdefgh"

func loadLearn() ([]LearnPath, []TalkPrompt) {
	var f struct {
		Sources map[string]struct {
			Title     string `json:"title"`
			URL       string `json:"url"`
			CheckedAt string `json:"checkedAt"`
		} `json:"sources"`
		Paths []struct {
			ID      string   `json:"id"`
			Title   string   `json:"title"`
			Why     string   `json:"why"`
			Stages  []string `json:"stages"`
			Lessons []struct {
				ID             string   `json:"id"`
				Title          string   `json:"title"`
				Weeks          [2]int   `json:"weeks"`
				Audience       string   `json:"audience"`
				Minutes        int      `json:"readingMinutes"`
				Stages         []string `json:"stages"`
				Source         string   `json:"source"`
				ExtraSources   []string `json:"extraSources"`
				Body           string   `json:"body"`
				TalkTonight    string   `json:"talkTonight"`
				UrgentHelpLink bool     `json:"urgentHelpLink"`
				Quiz           []struct {
					Question string   `json:"question"`
					Options  []string `json:"options"`
					Answer   string   `json:"answer"`
					Why      string   `json:"why"`
				} `json:"quiz"`
			} `json:"lessons"`
		} `json:"paths"`
	}
	if err := json.Unmarshal(learnPathsJSON, &f); err != nil {
		panic(fmt.Sprintf("learn_paths.json: %v", err))
	}
	source := func(id string) Source {
		s, ok := f.Sources[id]
		if !ok {
			panic("learn_paths.json: unknown source " + id)
		}
		at, err := time.Parse("2006-01-02", s.CheckedAt)
		if err != nil {
			panic("learn_paths.json: bad date for " + id)
		}
		return Source{Title: s.Title, URL: s.URL, CheckedAt: at}
	}
	paths := make([]LearnPath, 0, len(f.Paths))
	for _, p := range f.Paths {
		lp := LearnPath{ID: p.ID, Title: p.Title, Why: p.Why, Stages: p.Stages}
		for _, l := range p.Lessons {
			audience := []string{"mother", "partner"}
			if l.Audience != "both" {
				audience = []string{l.Audience}
			}
			lesson := Lesson{
				ID: l.ID, PathID: p.ID, Title: l.Title, Body: []string{l.Body}, Minutes: max(1, l.Minutes),
				WeekFrom: l.Weeks[0], WeekTo: l.Weeks[1], Audience: audience, Source: source(l.Source),
				ExtraSources: []Source{}, TalkPrompt: l.TalkTonight, UrgentHelpLink: l.UrgentHelpLink, Stages: p.Stages,
			}
			if len(l.Stages) > 0 {
				lesson.Stages = l.Stages
			}
			for _, id := range l.ExtraSources {
				lesson.ExtraSources = append(lesson.ExtraSources, source(id))
			}
			for i, q := range l.Quiz {
				question := Question{ID: fmt.Sprintf("%s-q%d", l.ID, i+1), LessonID: l.ID, Prompt: q.Question, Explanation: q.Why}
				for j, o := range q.Options {
					c := Choice{ID: choiceIDs[j : j+1], Text: o}
					question.Choices = append(question.Choices, c)
					if o == q.Answer {
						question.CorrectChoiceID = c.ID
					}
				}
				if question.CorrectChoiceID == "" {
					panic("learn_paths.json: no right answer for " + question.ID)
				}
				lesson.Quiz = append(lesson.Quiz, question)
			}
			lp.Lessons = append(lp.Lessons, lesson)
		}
		paths = append(paths, lp)
	}

	var t struct {
		Prompts []struct {
			ID    string `json:"id"`
			Kind  string `json:"kind"`
			Weeks [2]int `json:"weeks"`
			Text  string `json:"text"`
		} `json:"prompts"`
	}
	if err := json.Unmarshal(talkPromptsJSON, &t); err != nil {
		panic(fmt.Sprintf("talk_prompts.json: %v", err))
	}
	var prompts []TalkPrompt
	for _, p := range t.Prompts {
		// Journal prompts are for the journal composer, not the couple card.
		if p.Kind == "couple" {
			prompts = append(prompts, TalkPrompt{ID: p.ID, Text: p.Text, WeekFrom: p.Weeks[0], WeekTo: p.Weeks[1]})
		}
	}
	return paths, prompts
}

// LearnPathsFor returns the paths offered in the family's stage, in catalog
// order, each with only the lessons offered in that stage.
func LearnPathsFor(s State) []LearnPath {
	out := []LearnPath{}
	for _, p := range learnPaths {
		if !slices.Contains(p.Stages, s.Stage) {
			continue
		}
		p.Lessons = slices.DeleteFunc(slices.Clone(p.Lessons), func(l Lesson) bool { return !slices.Contains(l.Stages, s.Stage) })
		if len(p.Lessons) > 0 {
			out = append(out, p)
		}
	}
	return out
}

// LessonFor finds a lesson among the paths offered in the family's stage.
func LessonFor(s State, id string) (Lesson, bool) {
	l, ok := lessonsByID[id]
	if !ok || !slices.Contains(l.Stages, s.Stage) {
		return Lesson{}, false
	}
	return l, true
}

// QuestionFor finds a quiz question among the paths offered in the family's stage.
func QuestionFor(s State, id string) (Question, Lesson, bool) {
	q, ok := questionsByID[id]
	if !ok {
		return Question{}, Lesson{}, false
	}
	l, ok := LessonFor(s, q.LessonID)
	return q, l, ok
}

// LessonByID finds any lesson, whatever the stage (for nudges about past reads).
func LessonByID(id string) (Lesson, bool) {
	l, ok := lessonsByID[id]
	return l, ok
}

// LessonPromptPrefix marks a talk prompt that comes from a lesson.
const LessonPromptPrefix = "lesson:"

// CoupleTalkPrompts returns the pool prompts whose window covers the week,
// latest-opening first. Outside pregnancy the pool (written for pregnancy
// weeks) is not used.
func CoupleTalkPrompts(s State) []TalkPrompt {
	out := []TalkPrompt{}
	if s.Stage != "pregnancy" || !s.HasWeek {
		return out
	}
	for _, p := range coupleTalkPrompts {
		if p.WeekFrom <= s.Week && s.Week <= p.WeekTo {
			out = append(out, p)
		}
	}
	slices.SortStableFunc(out, func(a, b TalkPrompt) int {
		if a.WeekFrom != b.WeekFrom {
			return b.WeekFrom - a.WeekFrom
		}
		return strings.Compare(a.ID, b.ID)
	})
	return out
}

// TalkPromptText resolves a prompt id (pool id or lesson:<id>) to its text and
// lesson, if the prompt is one the family can see in its stage.
func TalkPromptText(s State, id string) (text, lessonID string, ok bool) {
	if lid, isLesson := strings.CutPrefix(id, LessonPromptPrefix); isLesson {
		l, ok := LessonFor(s, lid)
		if !ok || l.TalkPrompt == "" {
			return "", "", false
		}
		return l.TalkPrompt, l.ID, true
	}
	p, ok := coupleTalkPromptsByID[id]
	if !ok {
		return "", "", false
	}
	return p.Text, "", true
}
