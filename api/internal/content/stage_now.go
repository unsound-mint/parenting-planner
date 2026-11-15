package content

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"time"
)

// stage_now.json is the "what is happening now" line for every stage except
// pregnancy (which has size_weeks.json): week of life 1 to 12, then months,
// then half-years to 5 and years to 9, plus the two planning phases. Each
// entry names the pages it paraphrases (all opened on the checked date) and
// says "most children by this age"; nothing in it is a diagnosis.
//
//go:embed stage_now.json
var stageNowJSON []byte

// NowLine is one entry of the stage hero.
type NowLine struct {
	// Stage is a journey stage: planning, newborn, first_year, toddler,
	// preschool or school_age.
	Stage    string
	Period   string
	Headline string
	Detail   string
	PlayIdea string
	Note     string
	Sources  []Source
	// playIdeas is the period's whole "Try today" pool, PlayIdea first. The
	// lookups pick one by week, so the line changes every week inside a period
	// that lasts months.
	playIdeas []string
}

// forWeek returns the line with the play idea of week n (any count that moves
// by one each week: week of life, or calendar week for planning).
func (l NowLine) forWeek(n int) NowLine {
	if k := len(l.playIdeas); k > 0 {
		l.PlayIdea = l.playIdeas[(n%k+k)%k]
	}
	return l
}

type nowEntry struct {
	Headline   string   `json:"headline"`
	Detail     string   `json:"detail"`
	PlayIdea   string   `json:"playIdea"`
	PlayIdeas  []string `json:"playIdeas"`
	Sources    []string `json:"sources"`
	Week       int      `json:"week"`
	FromMonths int      `json:"fromMonths"`
	ToMonths   int      `json:"toMonths"`
	Stage      string   `json:"stage"`
	Period     string   `json:"period"`
}

type stageNowData struct {
	weeks    []NowLine
	ranges   []rangeLine
	planning map[string]NowLine
}

type rangeLine struct {
	from, to int
	line     NowLine
}

// WeeksOfLife is how many weeks of life have their own entry; the first
// 12 weeks are 84 days.
const WeeksOfLife = 12

var stageNow = loadStageNow()

func loadStageNow() stageNowData {
	var f struct {
		Notes    map[string]string                                 `json:"notes"`
		Sources  map[string]struct{ Title, URL, CheckedAt string } `json:"sources"`
		Weeks    []nowEntry                                        `json:"weeks"`
		Ranges   []nowEntry                                        `json:"ranges"`
		Planning map[string]nowEntry                               `json:"planning"`
	}
	if err := json.Unmarshal(stageNowJSON, &f); err != nil {
		panic(fmt.Sprintf("stage_now.json: %v", err))
	}
	line := func(e nowEntry, stage, period, note string) NowLine {
		l := NowLine{Stage: stage, Period: period, Headline: e.Headline, Detail: e.Detail, PlayIdea: e.PlayIdea, Note: note}
		l.playIdeas = append([]string{e.PlayIdea}, e.PlayIdeas...)
		for _, id := range e.Sources {
			s, ok := f.Sources[id]
			if !ok {
				panic("stage_now.json: unknown source " + id)
			}
			at, err := time.Parse("2006-01-02", s.CheckedAt)
			if err != nil {
				panic("stage_now.json: bad date for " + id)
			}
			l.Sources = append(l.Sources, Source{Title: s.Title, URL: s.URL, CheckedAt: at})
		}
		return l
	}
	var d stageNowData
	for _, w := range f.Weeks {
		d.weeks = append(d.weeks, line(w, "newborn", fmt.Sprintf("Week %d of life", w.Week), f.Notes["child"]))
	}
	for _, r := range f.Ranges {
		d.ranges = append(d.ranges, rangeLine{r.FromMonths, r.ToMonths, line(r, r.Stage, r.Period, f.Notes["child"])})
	}
	d.planning = map[string]NowLine{}
	for k, p := range f.Planning {
		d.planning[k] = line(p, "planning", p.Period, f.Notes["planning"])
	}
	return d
}

// NowForChild returns the line for a child born on birth, seen on today.
// The first 12 weeks are looked up by week of life, later ages by completed
// months; a child older than the last range gets the last entry. Inside a
// period longer than a week the play idea rotates by week of life.
func NowForChild(birth, today time.Time) NowLine {
	days := int(today.Sub(birth).Hours() / 24)
	if days < WeeksOfLife*7 {
		return stageNow.weeks[max(days, 0)/7]
	}
	return nowForMonths(birth, today).forWeek(days / 7)
}

func nowForMonths(birth, today time.Time) NowLine {
	months := (today.Year()-birth.Year())*12 + int(today.Month()-birth.Month())
	if today.Day() < birth.Day() {
		months--
	}
	months = max(months, 3) // week 13 can fall just before the third calendar month
	for _, r := range stageNow.ranges {
		if months >= r.from && months <= r.to {
			return r.line
		}
	}
	return stageNow.ranges[len(stageNow.ranges)-1].line
}

// NowForPlanning returns the planning line; stage is "planning" or "trying".
// There is no week to count from, so the play idea rotates by calendar week
// on the family's clock (which "Skip ahead a week" moves).
func NowForPlanning(stage string, today time.Time) (NowLine, bool) {
	l, ok := stageNow.planning[stage]
	return l.forWeek(CalendarWeek(today)), ok
}

// CalendarWeek counts whole weeks since Monday 1970-01-05, so it moves by one
// every Monday. Rotations with no pregnancy week or child age use it.
func CalendarWeek(today time.Time) int {
	monday := time.Date(1970, time.January, 5, 0, 0, 0, 0, time.UTC)
	return int(today.Sub(monday).Hours()/24) / 7
}
