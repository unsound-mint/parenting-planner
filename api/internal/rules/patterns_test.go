package rules

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func moodAt(daysAgo, mood int, sleep float64) PatternCheckin {
	return PatternCheckin{ID: uuid.New(), At: today.AddDate(0, 0, -daysAgo).Add(20 * time.Hour), Mood: mood, SleepHours: sleep}
}

func TestDetectMoodPatterns(t *testing.T) {
	cases := []struct {
		name     string
		stage    string
		checkins []PatternCheckin
		wantKind PatternKind // "" = no pattern
		wantDays int
	}{
		{"no check-ins", "pregnancy", nil, "", 0},
		{"two low days is not yet a pattern", "pregnancy", []PatternCheckin{moodAt(1, 2, 7), moodAt(2, 1, 7), moodAt(3, 4, 7)}, "", 0},
		{"three low days", "pregnancy", []PatternCheckin{moodAt(0, 2, 7), moodAt(2, 1, 5), moodAt(4, 2, 8)}, PatternLowMood, 3},
		{"three low days with short sleep", "postpartum", []PatternCheckin{moodAt(0, 2, 5), moodAt(1, 1, 4.5), moodAt(2, 2, 5.5), moodAt(3, 5, 8)}, PatternLowMoodAndSleep, 3},
		{"three low check-ins on one day", "pregnancy", []PatternCheckin{moodAt(0, 1, 5), moodAt(0, 1, 5), moodAt(0, 2, 5)}, "", 0},
		{"low days outside the window", "pregnancy", []PatternCheckin{moodAt(1, 2, 7), moodAt(2, 2, 7), moodAt(9, 1, 7)}, "", 0},
		{"recovered: good days do not count", "pregnancy", []PatternCheckin{moodAt(0, 4, 7), moodAt(1, 3, 7), moodAt(2, 5, 7), moodAt(3, 2, 5)}, "", 0},
		{"no perinatal guidance outside perinatal stages", "planning", []PatternCheckin{moodAt(0, 1, 5), moodAt(1, 1, 5), moodAt(2, 1, 5)}, "", 0},
	}
	for _, c := range cases {
		got := DetectMoodPatterns(Mother, c.stage, c.checkins, today)
		if c.wantKind == "" {
			if len(got) != 0 {
				t.Errorf("%s: got %+v, want no pattern", c.name, got)
			}
			continue
		}
		if len(got) != 1 || got[0].Kind != c.wantKind || got[0].Days != c.wantDays {
			t.Errorf("%s: got %+v, want one %s pattern over %d days", c.name, got, c.wantKind, c.wantDays)
		}
	}
}

func TestMoodPatternListsCheckinsOldestFirst(t *testing.T) {
	a, b, c := moodAt(4, 2, 7), moodAt(2, 1, 7), moodAt(0, 2, 7)
	got := DetectMoodPatterns(Mother, "pregnancy", []PatternCheckin{c, a, b, moodAt(1, 5, 8)}, today)
	if len(got) != 1 {
		t.Fatalf("got %d patterns, want 1", len(got))
	}
	p := got[0]
	if len(p.CheckinIDs) != 3 || p.CheckinIDs[0] != a.ID || p.CheckinIDs[1] != b.ID || p.CheckinIDs[2] != c.ID {
		t.Errorf("check-in ids must be the low ones, oldest first, got %v", p.CheckinIDs)
	}
	if !p.StartedOn.Equal(today.AddDate(0, 0, -4)) {
		t.Errorf("startedOn = %s, want the first low day", p.StartedOn)
	}
}

func TestMoodPatternMixedSleepIsLowMood(t *testing.T) {
	// Only two of the three low days had short sleep.
	got := DetectMoodPatterns(Mother, "pregnancy", []PatternCheckin{moodAt(0, 2, 5), moodAt(1, 2, 5), moodAt(2, 2, 8)}, today)
	if len(got) != 1 || got[0].Kind != PatternLowMood || len(got[0].CheckinIDs) != 3 {
		t.Errorf("got %+v, want low_mood over all three check-ins", got)
	}
}

func TestMoodPatternGoesToTheRightParent(t *testing.T) {
	low := []PatternCheckin{moodAt(0, 1, 5), moodAt(1, 2, 5), moodAt(2, 2, 5)}
	mom := DetectMoodPatterns(Mother, "pregnancy", low, today)
	partner := DetectMoodPatterns(Partner, "pregnancy", low, today)
	if mom[0].Source != srcUSPSTFPerinatalDepression || partner[0].Source != srcPSIDads {
		t.Errorf("sources: mother %s, partner %s", mom[0].Source.URL, partner[0].Source.URL)
	}
	if mom[0].ProviderType != "perinatal_therapist" || partner[0].ProviderType != "perinatal_therapist" {
		t.Errorf("provider types: %s, %s", mom[0].ProviderType, partner[0].ProviderType)
	}
}

// Patterns describe what was logged; they never assess or diagnose.
func TestMoodPatternWordingIsNotDiagnostic(t *testing.T) {
	low := []PatternCheckin{moodAt(0, 1, 5), moodAt(1, 2, 5), moodAt(2, 2, 7), moodAt(3, 2, 7)}
	for _, viewer := range []Role{Mother, Partner} {
		for _, cs := range [][]PatternCheckin{low, low[:3]} {
			for _, p := range DetectMoodPatterns(viewer, "pregnancy", cs, today) {
				msg := strings.ToLower(p.Message)
				for _, banned := range []string{"depress", "diagnos", "disorder", "you have", "symptom", "illness"} {
					if strings.Contains(msg, banned) {
						t.Errorf("%s %s message contains %q: %s", viewer, p.Kind, banned, p.Message)
					}
				}
				if p.Source.URL == "" || p.Source.CheckedAt.IsZero() {
					t.Errorf("pattern without a source: %+v", p)
				}
			}
		}
	}
}
