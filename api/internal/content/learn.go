package content

import (
	"embed"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"
)

// Every *_paths.json file is part of the learning catalog, read in file name
// order: learn_paths.json holds 8 paths, 32 lessons and their quizzes, and
// nutrition_paths.json 4 food paths from planning to preschool. Adding a
// file in the same shape adds paths without code changes. Each file carries its
// own sources map; every path needs "stages" (a path without any is never
// offered); weeks matter only for lessons offered in pregnancy; each lesson
// needs two or more quiz questions; path and lesson ids stay unique across
// files. learn_test.go checks all of this. Lesson bodies are our own plain-language writing from the cited
// page; every source was opened on its checkedAt date and numbers were checked
// against the page text. The labor lesson cites NICHD only: the MedlinePlus
// labor page is A.D.A.M. content that forbids derivative works.
// talk_prompts.json is the couple and journal prompt pool by pregnancy week.
// The prompts make no health claims, so they cite nothing.
//
//go:embed *_paths.json
var learnPathFiles embed.FS

//go:embed talk_prompts.json
var talkPromptsJSON []byte

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
	// InPregnancy is false outside pregnancy, where weeks do not apply.
	InPregnancy bool
}

// StateOf places the lesson against the family's stage and week. Outside
// pregnancy (or without a week) every lesson is open and timing is now.
func (l Lesson) StateOf(s State) LessonState {
	if s.Stage != "pregnancy" || !s.HasWeek {
		return LessonState{Timing: TimingNow}
	}
	st := LessonState{Timing: TimingNow, InPregnancy: true}
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
	// Source backs the explanation: the question's own, else the lesson's.
	Source Source
}

type Choice struct{ ID, Text string }

// TalkPrompt is a couple prompt from the pool.
type TalkPrompt struct {
	ID, Text         string
	WeekFrom, WeekTo int
	// Stages is set on prompts for stages other than pregnancy; those have no weeks.
	Stages []string
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
	pregnancyLeads = pickPregnancyLeads()
}

const choiceIDs = "abcdefgh"

func loadLearn() ([]LearnPath, []TalkPrompt) {
	files, err := learnPathFiles.ReadDir(".")
	if err != nil {
		panic(err)
	}
	var paths []LearnPath
	seen := map[string]string{}
	for _, file := range files {
		data, err := learnPathFiles.ReadFile(file.Name())
		if err != nil {
			panic(err)
		}
		for _, p := range loadPathFile(file.Name(), data) {
			for _, id := range append([]string{"path " + p.ID}, lessonKeys(p)...) {
				if prev, dup := seen[id]; dup {
					panic(fmt.Sprintf("%s: %s is already in %s", file.Name(), id, prev))
				}
				seen[id] = file.Name()
			}
			paths = append(paths, p)
		}
	}
	return paths, loadTalkPrompts()
}

func lessonKeys(p LearnPath) []string {
	out := make([]string, 0, len(p.Lessons))
	for _, l := range p.Lessons {
		out = append(out, "lesson "+l.ID)
	}
	return out
}

// loadPathFile parses one catalog file; each file carries its own sources.
func loadPathFile(name string, data []byte) []LearnPath {
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
					Source   string   `json:"source"`
				} `json:"quiz"`
			} `json:"lessons"`
		} `json:"paths"`
	}
	if err := json.Unmarshal(data, &f); err != nil {
		panic(fmt.Sprintf("%s: %v", name, err))
	}
	source := func(id string) Source {
		s, ok := f.Sources[id]
		if !ok {
			panic(name + ": unknown source " + id)
		}
		at, err := time.Parse("2006-01-02", s.CheckedAt)
		if err != nil {
			panic(name + ": bad date for " + id)
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
				question := Question{ID: fmt.Sprintf("%s-q%d", l.ID, i+1), LessonID: l.ID, Prompt: q.Question, Explanation: q.Why, Source: lesson.Source}
				if q.Source != "" {
					question.Source = source(q.Source)
				}
				for j, o := range q.Options {
					c := Choice{ID: choiceIDs[j : j+1], Text: o}
					question.Choices = append(question.Choices, c)
					if o == q.Answer {
						question.CorrectChoiceID = c.ID
					}
				}
				if question.CorrectChoiceID == "" {
					panic(name + ": no right answer for " + question.ID)
				}
				lesson.Quiz = append(lesson.Quiz, question)
			}
			lp.Lessons = append(lp.Lessons, lesson)
		}
		paths = append(paths, lp)
	}
	return paths
}

func loadTalkPrompts() []TalkPrompt {
	var t struct {
		Prompts []struct {
			ID     string   `json:"id"`
			Kind   string   `json:"kind"`
			Weeks  [2]int   `json:"weeks"`
			Stages []string `json:"stages"`
			Text   string   `json:"text"`
		} `json:"prompts"`
	}
	if err := json.Unmarshal(talkPromptsJSON, &t); err != nil {
		panic(fmt.Sprintf("talk_prompts.json: %v", err))
	}
	var prompts []TalkPrompt
	for _, p := range t.Prompts {
		// Journal prompts are for the journal composer, not the couple card.
		if p.Kind == "couple" {
			prompts = append(prompts, TalkPrompt{ID: p.ID, Text: p.Text, WeekFrom: p.Weeks[0], WeekTo: p.Weeks[1], Stages: p.Stages})
		}
	}
	return prompts
}

// AllLearnPaths returns every path with all its lessons, whatever the stage.
func AllLearnPaths() []LearnPath { return slices.Clone(learnPaths) }

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

// CoupleTalkPrompts returns this week's pool prompts in the order to offer
// them. In pregnancy that is the prompts whose window covers the gestational
// week; in other stages the prompts written for the stage. The list is
// rotated by week (the gestational week, else the calendar week of today on
// the family's clock) so the first prompt changes every week; a prompt whose
// window opened this week leads, since it is the newest thing to talk about.
// TestTalkPromptsChangeEveryWeek guards this.
func CoupleTalkPrompts(s State, today time.Time) []TalkPrompt {
	switch {
	case s.Stage == "pregnancy" && s.HasWeek:
		return pregnancyTalkPrompts(s.Week)
	case s.Stage != "pregnancy":
		out := []TalkPrompt{}
		for _, p := range coupleTalkPrompts {
			if slices.Contains(p.Stages, s.Stage) {
				out = append(out, p)
			}
		}
		return rotate(out, CalendarWeek(today))
	}
	return []TalkPrompt{}
}

// pregnancyTalkPrompts rotates the week's window by the week and puts the
// week's lead (pregnancyLeads) first.
func pregnancyTalkPrompts(week int) []TalkPrompt {
	out := rotate(pregnancyWindow(week), week)
	if i := slices.IndexFunc(out, func(p TalkPrompt) bool { return p.ID == pregnancyLeads[week] }); i > 0 {
		lead := out[i]
		out = append([]TalkPrompt{lead}, slices.Delete(out, i, i+1)...)
	}
	return out
}

func pregnancyWindow(week int) []TalkPrompt {
	out := []TalkPrompt{}
	for _, p := range coupleTalkPrompts {
		if len(p.Stages) == 0 && p.WeekFrom <= week && week <= p.WeekTo {
			out = append(out, p)
		}
	}
	return out
}

// pregnancyLeads is the first prompt of each pregnancy week, picked once in
// week order: the prompt in the week's window that led longest ago (or never),
// in rotation order, so one that opens this week leads first. Windows open and
// close, so the plain rotation alone would flip back and forth between the
// same few prompts.
var pregnancyLeads map[int]string

func pickPregnancyLeads() map[int]string {
	leads := map[int]string{}
	ledIn := map[string]int{}
	for week := firstPregnancyWeek; week <= lastPregnancyWeek; week++ {
		rotated := rotate(pregnancyWindow(week), week)
		if len(rotated) == 0 {
			continue
		}
		lead, oldest := "", week
		for _, p := range rotated {
			at, ok := ledIn[p.ID]
			if !ok {
				at = -1
			}
			if at < oldest {
				lead, oldest = p.ID, at
			}
		}
		leads[week], ledIn[lead] = lead, week
	}
	return leads
}

// rotate sorts the prompts by id and starts the list at week mod its length.
func rotate(out []TalkPrompt, week int) []TalkPrompt {
	if len(out) == 0 {
		return out
	}
	slices.SortStableFunc(out, func(a, b TalkPrompt) int { return strings.Compare(a.ID, b.ID) })
	k := (week%len(out) + len(out)) % len(out)
	return append(out[k:], out[:k]...)
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
