// Package journey places a family on the timeline from planning to age 9.
// The position and the stage dates come from the family's stored stage, due
// date and youngest child's birth date; the upcoming items are the head of
// the parent's rule plan (internal/plan), so nothing on the timeline is
// hardcoded.
package journey

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/plan"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

type Stage string

const (
	Planning  Stage = "planning"
	Pregnancy Stage = "pregnancy"
	Birth     Stage = "birth"
	Newborn   Stage = "newborn"
	FirstYear Stage = "first_year"
	Toddler   Stage = "toddler"
	Preschool Stage = "preschool"
	SchoolAge Stage = "school_age"
)

// Stages is the timeline in order.
var Stages = []Stage{Planning, Pregnancy, Birth, Newborn, FirstYear, Toddler, Preschool, SchoolAge}

// After birth, each stage starts at this child age in months. Birth is the
// day of birth itself; school age runs until the 9th birthday.
var startMonths = map[Stage]int{Newborn: 0, FirstYear: 3, Toddler: 12, Preschool: 36, SchoolAge: 60}

const endMonths = 108 // 9th birthday

// MaxUpcoming is how many plan items the timeline shows.
const MaxUpcoming = 5

type Status string

const (
	Past    Status = "past"
	Current Status = "current"
	Future  Status = "future"
)

type Span struct {
	Stage  Stage
	Status Status
	Starts *time.Time
	Ends   *time.Time
}

type Position struct {
	Stage           Stage
	GestationalWeek *int
	Child           *store.Child // youngest child, set after birth
}

type Journey struct {
	Current  Position
	Stages   []Span
	Upcoming []rules.Item
}

// ForMember builds the journey for one parent. The clock is passed in so
// callers and tests control it.
func ForMember(ctx context.Context, q *store.Queries, familyID, memberID uuid.UUID, today, now time.Time) (Journey, error) {
	fam, err := q.GetFamily(ctx, familyID)
	if err != nil {
		return Journey{}, fmt.Errorf("family: %w", err)
	}
	children, err := q.ListChildren(ctx, familyID)
	if err != nil {
		return Journey{}, err
	}
	items, err := plan.ForMember(ctx, q, familyID, memberID, today, now)
	if err != nil {
		return Journey{}, err
	}
	var youngest *store.Child
	if len(children) > 0 {
		youngest = &children[len(children)-1] // ListChildren orders by birth date
	}
	j := Place(fam.Stage, fam.DueDate, youngest, today)
	j.Upcoming = items[:min(len(items), MaxUpcoming)]
	return j, nil
}

// Place puts a family on the timeline. The stored stage decides which phase
// the family is in (a pregnant family with an older child is in pregnancy);
// the due date or the youngest child's birth date dates every stage.
func Place(stage string, due *time.Time, youngest *store.Child, today time.Time) Journey {
	var (
		pos   Position
		birth *time.Time // the anchor every later stage is dated from
	)
	switch {
	case stage == "planning" || stage == "trying":
		pos.Stage = Planning
	case stage == "pregnancy":
		pos.Stage = Pregnancy
		if due != nil {
			f := rules.Facts{Today: today, Stage: stage, DueDate: due}
			if w, ok := f.GestationalWeek(); ok {
				pos.GestationalWeek = &w
			}
			birth = due
		}
	case youngest != nil:
		pos.Child = youngest
		birth = &youngest.BirthDate
		pos.Stage = stageAtAge(youngest.BirthDate, today)
	default:
		// After birth but no child on record: trust the stored stage.
		pos.Stage = fromStoredStage(stage)
	}

	cur := index(pos.Stage)
	spans := make([]Span, len(Stages))
	for i, s := range Stages {
		spans[i] = Span{Stage: s, Status: Future}
		switch {
		case i < cur:
			spans[i].Status = Past
		case i == cur:
			spans[i].Status = Current
		}
		if birth != nil {
			spans[i].Starts, spans[i].Ends = datesFor(s, *birth)
		}
	}
	return Journey{Current: pos, Stages: spans}
}

// datesFor returns the first and last day of a stage, given the birth (or
// due) date. Planning has no dates.
func datesFor(s Stage, birth time.Time) (*time.Time, *time.Time) {
	switch s {
	case Planning:
		return nil, nil
	case Pregnancy:
		start, end := birth.AddDate(0, 0, -280), birth.AddDate(0, 0, -1)
		return &start, &end
	case Birth:
		return &birth, &birth
	}
	start := birth.AddDate(0, startMonths[s], 0)
	if s == Newborn {
		start = birth.AddDate(0, 0, 1)
	}
	endMonth := endMonths
	if next := index(s) + 1; next < len(Stages) {
		endMonth = startMonths[Stages[next]]
	}
	end := birth.AddDate(0, endMonth, -1)
	return &start, &end
}

// stageAtAge is the stage of a child born on birth, as of today. Children
// older than 9 stay at school age, the end of the timeline.
func stageAtAge(birth, today time.Time) Stage {
	if !today.After(birth) {
		return Birth
	}
	for i := len(Stages) - 1; i >= index(Newborn); i-- {
		s := Stages[i]
		if !today.Before(birth.AddDate(0, startMonths[s], 0)) {
			return s
		}
	}
	return Newborn
}

func fromStoredStage(stage string) Stage {
	switch stage {
	case "postpartum":
		return Newborn
	case "infant":
		return FirstYear
	case "toddler":
		return Toddler
	case "preschool":
		return Preschool
	case "school_age":
		return SchoolAge
	}
	return Planning
}

func index(s Stage) int {
	for i, x := range Stages {
		if x == s {
			return i
		}
	}
	return 0
}
