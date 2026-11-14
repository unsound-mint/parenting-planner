package rules

import (
	"strings"
	"testing"
	"time"
)

func TestScoreEPDS(t *testing.T) {
	cases := []struct {
		name    string
		answers []int
		score   int
		band    Band
		urgent  bool
	}{
		{"all lowest", []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, 0, Green, false},
		{"9 is green", []int{1, 1, 1, 1, 1, 1, 1, 1, 1, 0}, 9, Green, false},
		{"10 is amber", []int{1, 1, 1, 1, 1, 1, 1, 1, 2, 0}, 10, Amber, false},
		{"12 is amber", []int{2, 2, 1, 1, 1, 1, 1, 1, 2, 0}, 12, Amber, false},
		{"13 is red", []int{2, 2, 2, 1, 1, 1, 1, 1, 2, 0}, 13, Red, false},
		{"Hardly ever on item 10 is urgent with a low total", []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 1}, 1, Green, true},
		{"top scores", []int{3, 3, 3, 3, 3, 3, 3, 3, 3, 3}, 30, Red, true},
	}
	for _, c := range cases {
		got, err := Score(EPDS, c.answers)
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if got.Score != c.score || got.Band != c.band || got.Urgent != c.urgent || got.MaxScore != 30 {
			t.Errorf("%s: got %+v, want score %d band %s urgent %v", c.name, got, c.score, c.band, c.urgent)
		}
	}
}

func TestScorePHQ9(t *testing.T) {
	cases := []struct {
		answers []int
		band    Band
		urgent  bool
	}{
		{[]int{1, 1, 1, 1, 0, 0, 0, 0, 0}, Green, false},
		{[]int{1, 1, 1, 1, 1, 0, 0, 0, 0}, Amber, false},
		{[]int{2, 2, 2, 1, 1, 1, 1, 0, 0}, Red, false},
		{[]int{0, 0, 0, 0, 0, 0, 0, 0, 2}, Green, true},
	}
	for _, c := range cases {
		got, err := Score(PHQ9, c.answers)
		if err != nil || got.Band != c.band || got.Urgent != c.urgent || got.MaxScore != 27 {
			t.Errorf("%v: got %+v (%v), want %s urgent %v", c.answers, got, err, c.band, c.urgent)
		}
	}
}

func TestScoreRejectsAnswersThatDoNotFit(t *testing.T) {
	for _, c := range []struct {
		instrument string
		answers    []int
	}{
		{EPDS, []int{0, 0, 0, 0, 0, 0, 0, 0, 0}},
		{PHQ9, []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 0}},
		{EPDS, []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 4}},
		{"gad7", []int{0}},
	} {
		if _, err := Score(c.instrument, c.answers); err != ErrAnswers {
			t.Errorf("%s %v: err = %v, want ErrAnswers", c.instrument, c.answers, err)
		}
	}
}

// The EPDS prints reverse-scored questions (3 and 5 to 10) with the top box
// worth 3; the others start at 0.
func TestEPDSReverseScoring(t *testing.T) {
	for i, q := range epds.Questions {
		reverse := i == 2 || i >= 4
		if top := q.Choices[0].Value; (top == 3) != reverse {
			t.Errorf("question %d: top box scores %d", i+1, top)
		}
	}
}

func TestBandMessagesNeverDiagnose(t *testing.T) {
	for _, in := range Instruments() {
		for _, b := range []Band{Green, Amber, Red} {
			for _, word := range []string{"you have depression", "mild", "moderate", "severe", "disorder"} {
				if msg := BandMessage(in.ID, b); strings.Contains(strings.ToLower(msg), word) {
					t.Errorf("%s %s message says %q: %s", in.ID, b, word, msg)
				}
			}
		}
	}
}

// newbornAt builds facts for a family whose baby is the given days old.
func newbornAt(days int, viewer Role) Facts {
	f := pregnantAt(0, viewer)
	f.Stage, f.DueDate = "postpartum", nil
	f.Children = []ChildFacts{{Name: "Leo", BirthDate: today.AddDate(0, 0, -days)}}
	return f
}

func TestMoodScreenAtWellBabyVisits(t *testing.T) {
	daysAgo := func(n int) []ScreeningSample {
		return []ScreeningSample{{At: today.AddDate(0, 0, -n), Instrument: EPDS, Band: Green}}
	}
	cases := []struct {
		name   string
		days   int
		viewer Role
		taken  []ScreeningSample
		want   Status
	}{
		{"too early", 10, Mother, nil, ""},
		{"week before the 1-month visit", 26, Mother, nil, Upcoming},
		{"after the 1-month visit", 40, Mother, nil, Due},
		{"partner after the 1-month visit", 49, Partner, nil, Due},
		{"taken after the 1-month visit", 49, Mother, daysAgo(14), ""},
		{"taken before the 1-month window", 49, Partner, daysAgo(30), Due},
		{"2-month window opens", 56, Mother, daysAgo(21), Upcoming},
		{"after the 6-month visit window", 240, Mother, nil, ""},
	}
	for _, c := range cases {
		f := newbornAt(c.days, c.viewer)
		f.MoodScreenings = c.taken
		id := "mood-screen-mother"
		if c.viewer == Partner {
			id = "mood-screen-partner"
		}
		it := find(Plan(All(), f), id)
		if c.want == "" {
			if it != nil {
				t.Errorf("%s: got %+v, want none", c.name, it)
			}
			continue
		}
		if it == nil || it.Status != c.want || it.Category != MentalHealth {
			t.Errorf("%s: got %+v, want %s", c.name, it, c.want)
		}
		if _, ok := SuggestedInstrument(f); !ok {
			t.Errorf("%s: the plan asks, so EPDS must be suggested", c.name)
		}
	}
	if find(Plan(All(), pregnantAt(30, Mother)), "mood-screen-mother") != nil {
		t.Error("no well-baby visit questionnaire during pregnancy")
	}
}

func TestScreeningFollowUp(t *testing.T) {
	at := func(daysAgo int, instrument string, band Band, urgent bool) []ScreeningSample {
		return []ScreeningSample{{At: today.AddDate(0, 0, -daysAgo).Add(10 * time.Hour), Instrument: instrument, Score: 11, Band: band, Urgent: urgent}}
	}
	cases := []struct {
		name  string
		taken []ScreeningSample
		id    string
		want  Status
	}{
		{"green: nothing", at(1, EPDS, Green, false), "epds-repeat", ""},
		{"EPDS amber: repeat in two weeks", at(1, EPDS, Amber, false), "epds-repeat", Upcoming},
		{"EPDS amber two weeks on", at(15, EPDS, Amber, false), "epds-repeat", Due},
		{"PHQ-9 amber", at(1, PHQ9, Amber, false), "phq9-repeat", Upcoming},
		{"EPDS red", at(1, EPDS, Red, false), "epds-talk-to-doctor", Due},
		{"PHQ-9 red", at(3, PHQ9, Red, false), "phq9-talk-to-doctor", Due},
		{"EPDS red long ago", at(40, EPDS, Red, false), "epds-talk-to-doctor", ""},
		{"self-harm answer with a green total", at(1, EPDS, Green, true), "epds-talk-to-doctor", Due},
		{"self-harm answer does not ask to wait two weeks", at(1, EPDS, Amber, true), "epds-repeat", ""},
	}
	for _, c := range cases {
		f := newbornAt(49, Partner)
		f.MoodScreenings = c.taken
		it := find(Plan(All(), f), c.id)
		if c.want == "" {
			if it != nil {
				t.Errorf("%s: got %+v, want none", c.name, it)
			}
			continue
		}
		if it == nil || it.Status != c.want {
			t.Errorf("%s: got %+v, want %s", c.name, it, c.want)
		}
	}
}
