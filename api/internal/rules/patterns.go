package rules

import (
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
)

// Mood patterns describe what a parent's own check-ins show over the last
// week. They are descriptive, never diagnostic: they say what was logged and
// suggest talking to someone. They use the same threshold and window as the
// low-mood plan rule, so whenever a pattern exists the plan has that item too.

type PatternKind string

const (
	PatternLowMood         PatternKind = "low_mood"
	PatternLowMoodAndSleep PatternKind = "low_mood_and_sleep"
)

// shortSleepHours: a low day also counts as a short-sleep day below this.
const shortSleepHours = 6.0

// PatternCheckin is one of the viewing parent's own mood check-ins.
type PatternCheckin struct {
	ID         uuid.UUID
	At         time.Time
	Mood       int // 1 = very low, 5 = very good
	SleepHours float64
}

type MoodPattern struct {
	Kind         PatternKind
	StartedOn    time.Time // date of the first check-in in the pattern
	Days         int       // distinct days in the pattern
	CheckinIDs   []uuid.UUID
	Message      string
	ProviderType string
	Source       Source
}

// DetectMoodPatterns finds patterns in the viewer's own check-ins. Pass only
// the viewer's own check-ins: a pattern never draws on another person's data,
// even data they shared. It returns at most one pattern: low mood together
// with short sleep when that holds on enough days, otherwise low mood alone.
func DetectMoodPatterns(viewer Role, stage string, checkins []PatternCheckin, today time.Time) []MoodPattern {
	if !perinatalStages[stage] {
		return nil
	}
	since := today.AddDate(0, 0, -lowMoodWindow)
	var low, lowShortSleep []PatternCheckin
	for _, c := range checkins {
		if c.At.Before(since) || c.Mood > lowMoodThreshold {
			continue
		}
		low = append(low, c)
		if c.SleepHours < shortSleepHours {
			lowShortSleep = append(lowShortSleep, c)
		}
	}
	if n := distinctDays(lowShortSleep); n >= lowMoodDays {
		return []MoodPattern{newPattern(viewer, PatternLowMoodAndSleep, lowShortSleep,
			fmt.Sprintf("On %d of the last %d days you logged a low mood and less than %d hours of sleep.", n, lowMoodWindow, int(shortSleepHours)))}
	}
	if n := distinctDays(low); n >= lowMoodDays {
		return []MoodPattern{newPattern(viewer, PatternLowMood, low,
			fmt.Sprintf("You logged a low mood on %d of the last %d days.", n, lowMoodWindow))}
	}
	return nil
}

func newPattern(viewer Role, kind PatternKind, cs []PatternCheckin, observed string) MoodPattern {
	sorted := append([]PatternCheckin{}, cs...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].At.Before(sorted[j].At) })
	ids := make([]uuid.UUID, len(sorted))
	for i, c := range sorted {
		ids[i] = c.ID
	}
	first := sorted[0].At.UTC()
	p := MoodPattern{
		Kind:         kind,
		StartedOn:    time.Date(first.Year(), first.Month(), first.Day(), 0, 0, 0, 0, time.UTC),
		Days:         distinctDays(sorted),
		CheckinIDs:   ids,
		ProviderType: "perinatal_therapist",
		Message: observed + " Weeks like this are common around a birth, and talking it through with someone helps." +
			" A perinatal therapist, your OB or your midwife is a good place to start.",
		Source: srcUSPSTFPerinatalDepression,
	}
	if viewer == Partner {
		p.Message = observed + " Partners have hard weeks around a birth too, and talking it through with someone helps." +
			" A perinatal therapist or your doctor is a good place to start."
		p.Source = srcPSIDads
	}
	return p
}

func distinctDays(cs []PatternCheckin) int {
	days := map[string]bool{}
	for _, c := range cs {
		days[c.At.UTC().Format(time.DateOnly)] = true
	}
	return len(days)
}
