package rules

import (
	"errors"
	"fmt"
	"time"
)

// Mood questionnaires: the catalog (wording copied from the published
// instrument, never generated), the scoring, and the plan rules that ask for
// a questionnaire or follow up on one. A band is where a total falls on the
// instrument's published score ranges; it is never a diagnosis.

var (
	// Question and choice wording, item scoring and the reproduction
	// permission ("Users may reproduce the scale without further permission
	// providing they respect copyright by quoting the names of the authors,
	// the title and the source of the paper in all reproduced copies").
	srcEPDSForm = Source{
		Title:     "Cox JL, Holden JM, Sagovsky R. Detection of postnatal depression: Development of the 10-item Edinburgh Postnatal Depression Scale. Br J Psychiatry 1987;150:782-786 (University of Washington copy)",
		URL:       "https://depts.washington.edu/psychres/wordpress/wp-content/uploads/2017/09/edinburgh_scale.pdf",
		CheckedAt: day(2026, 11, 14),
	}
	// Score ranges: "0-9 ... 10-12: ... Repeat the EDS in 2 weeks time ...
	// 13 +: Scores above 12 require further assessment", and "Any woman who
	// scores 1, 2 or 3 on item 10 requires further evaluation".
	srcEPDSScoring = Source{
		Title:     "Black Dog Institute: The Edinburgh Postnatal Depression Scale, clinical scoring guide",
		URL:       "https://www.blackdoginstitute.org.au/wp-content/uploads/2020/04/edinburgh-postnatal-depression-scale.pdf",
		CheckedAt: day(2026, 11, 14),
	}
	// Question wording and scoring; "No permission required to reproduce,
	// translate, display or distribute."
	srcPHQ9Form = Source{
		Title:     "Patient Health Questionnaire-9 (PHQ-9), Spitzer, Williams, Kroenke and colleagues (University of Washington copy)",
		URL:       "https://uwhatc.uw.edu/PDF/TF-%20CBT/pages/3%20Assessment/Standardized%20Measures/PHQ9-English.pdf",
		CheckedAt: day(2026, 11, 14),
	}
	// Score ranges, Table 4: "0-4 None-minimal ... 5-9 Mild: Watchful
	// waiting; repeat PHQ-9 at follow-up ... 10-14 Moderate: Treatment plan",
	// and "a cutpoint of 10 or greater is considered a 'yellow flag'".
	srcPHQ9Scoring = Source{
		Title:     "PHQ and GAD-7 Instructions (phqscreeners.com)",
		URL:       "https://www.phqscreeners.com/images/sites/g/files/g10016261/f/201412/instructions.pdf",
		CheckedAt: day(2026, 11, 14),
	}
	// The periodicity schedule marks "Maternal Depression Screening" at the
	// 1, 2, 4 and 6 month visits.
	srcBrightFuturesSchedule = Source{
		Title:     "AAP Bright Futures: Recommendations for Preventive Pediatric Health Care (periodicity schedule)",
		URL:       "https://downloads.aap.org/aap/pdf/periodicity_schedule.pdf",
		CheckedAt: day(2026, 11, 14),
	}
)

const (
	EPDS = "epds"
	PHQ9 = "phq9"
)

type Band string

const (
	Green Band = "green"
	Amber Band = "amber"
	Red   Band = "red"
)

type ScreeningChoice struct {
	Value int
	Label string
}

type ScreeningQuestion struct {
	Text    string
	Choices []ScreeningChoice // in the order the instrument prints them
}

// Instrument is one questionnaire as published.
type Instrument struct {
	ID        string
	Title     string
	Intro     string
	Questions []ScreeningQuestion
	// Source is where the wording comes from; ScoringSource is where the
	// score ranges come from.
	Source        Source
	ScoringSource Source
	// AmberFrom and RedFrom are the lowest totals of the amber and red bands.
	AmberFrom, RedFrom int
	// UrgentItem is the 0-based index of the self-harm question.
	UrgentItem int
}

// MaxScore is the highest possible total.
func (in Instrument) MaxScore() int {
	n := 0
	for _, q := range in.Questions {
		top := 0
		for _, c := range q.Choices {
			top = max(top, c.Value)
		}
		n += top
	}
	return n
}

func (in Instrument) band(score int) Band {
	switch {
	case score >= in.RedFrom:
		return Red
	case score >= in.AmberFrom:
		return Amber
	}
	return Green
}

// Choices scored 0 to 3 from the top, and the reverse.
func up(labels ...string) []ScreeningChoice {
	out := make([]ScreeningChoice, len(labels))
	for i, l := range labels {
		out[i] = ScreeningChoice{Value: i, Label: l}
	}
	return out
}

func down(labels ...string) []ScreeningChoice {
	out := make([]ScreeningChoice, len(labels))
	for i, l := range labels {
		out[i] = ScreeningChoice{Value: len(labels) - 1 - i, Label: l}
	}
	return out
}

// Questions 1, 2 and 4 score the top box 0; questions 3 and 5 to 10 are
// reverse scored. The partner takes the same scale with the same cutoffs: no
// source opened for this catalog gives a different cutoff for partners.
var epds = Instrument{
	ID:    EPDS,
	Title: "Edinburgh Postnatal Depression Scale (EPDS)",
	Intro: "As you are pregnant or have recently had a baby, we would like to know how you are feeling. Please check the answer that comes closest to how you have felt IN THE PAST 7 DAYS, not just how you feel today.",
	Questions: []ScreeningQuestion{
		{"I have been able to laugh and see the funny side of things", up("As much as I always could", "Not quite so much now", "Definitely not so much now", "Not at all")},
		{"I have looked forward with enjoyment to things", up("As much as I ever did", "Rather less than I used to", "Definitely less than I used to", "Hardly at all")},
		{"I have blamed myself unnecessarily when things went wrong", down("Yes, most of the time", "Yes, some of the time", "Not very often", "No, never")},
		{"I have been anxious or worried for no good reason", up("No, not at all", "Hardly ever", "Yes, sometimes", "Yes, very often")},
		{"I have felt scared or panicky for no very good reason", down("Yes, quite a lot", "Yes, sometimes", "No, not much", "No, not at all")},
		{"Things have been getting on top of me", down("Yes, most of the time I haven't been able to cope at all", "Yes, sometimes I haven't been coping as well as usual", "No, most of the time I have coped quite well", "No, I have been coping as well as ever")},
		{"I have been so unhappy that I have had difficulty sleeping", down("Yes, most of the time", "Yes, sometimes", "Not very often", "No, not at all")},
		{"I have felt sad or miserable", down("Yes, most of the time", "Yes, quite often", "Not very often", "No, not at all")},
		{"I have been so unhappy that I have been crying", down("Yes, most of the time", "Yes, quite often", "Only occasionally", "No, never")},
		{"The thought of harming myself has occurred to me", down("Yes, quite often", "Sometimes", "Hardly ever", "Never")},
	},
	Source:        srcEPDSForm,
	ScoringSource: srcEPDSScoring,
	AmberFrom:     10,
	RedFrom:       13,
	UrgentItem:    9,
}

func phqChoices() []ScreeningChoice {
	return up("Not at all", "Several days", "More than half the days", "Nearly every day")
}

var phq9 = Instrument{
	ID:    PHQ9,
	Title: "Patient Health Questionnaire (PHQ-9)",
	Intro: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
	Questions: []ScreeningQuestion{
		{"Little interest or pleasure in doing things", phqChoices()},
		{"Feeling down, depressed, or hopeless", phqChoices()},
		{"Trouble falling or staying asleep, or sleeping too much", phqChoices()},
		{"Feeling tired or having little energy", phqChoices()},
		{"Poor appetite or overeating", phqChoices()},
		{"Feeling bad about yourself — or that you are a failure or have let yourself or your family down", phqChoices()},
		{"Trouble concentrating on things, such as reading the newspaper or watching television", phqChoices()},
		{"Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual", phqChoices()},
		{"Thoughts that you would be better off dead or of hurting yourself in some way", phqChoices()},
	},
	Source:        srcPHQ9Form,
	ScoringSource: srcPHQ9Scoring,
	AmberFrom:     5,
	RedFrom:       10,
	UrgentItem:    8,
}

// Instruments is the catalog, in the order the questionnaire list shows it.
func Instruments() []Instrument { return []Instrument{epds, phq9} }

// InstrumentByID returns the catalog entry for id.
func InstrumentByID(id string) (Instrument, bool) {
	for _, in := range Instruments() {
		if in.ID == id {
			return in, true
		}
	}
	return Instrument{}, false
}

// ErrAnswers means the answers do not fit the instrument.
var ErrAnswers = errors.New("answers must have one of the printed scores for each question, in order")

// ScreeningScore is a scored questionnaire.
type ScreeningScore struct {
	Score, MaxScore int
	// Band depends on the total only, so a shared result never reveals the
	// self-harm answer to anyone else.
	Band Band
	// Urgent: the self-harm question was answered above its lowest value,
	// whatever the total. The UI opens the fixed crisis screen.
	Urgent bool
}

// Score sums the answers (each the score of the chosen box) and places the
// total on the instrument's published ranges.
func Score(instrument string, answers []int) (ScreeningScore, error) {
	in, ok := InstrumentByID(instrument)
	if !ok || len(answers) != len(in.Questions) {
		return ScreeningScore{}, ErrAnswers
	}
	total := 0
	for i, a := range answers {
		valid := false
		for _, c := range in.Questions[i].Choices {
			valid = valid || c.Value == a
		}
		if !valid {
			return ScreeningScore{}, ErrAnswers
		}
		total += a
	}
	return ScreeningScore{Score: total, MaxScore: in.MaxScore(), Band: in.band(total), Urgent: answers[in.UrgentItem] > 0}, nil
}

// UrgentMessage is shown to the author of an urgent result, with the fixed
// crisis screen. From the EPDS form: "If you have had ANY thoughts of harming
// yourself, please tell your GP or your midwife today."
const UrgentMessage = "You said thoughts of harming yourself have come up. Please tell your doctor or midwife today. The help screen has numbers you can call or text right now."

// BandMessage is the fixed wording for the author's own result. It says what
// to do next, never what the parent has.
func BandMessage(instrument string, b Band) string {
	switch {
	case b == Red:
		return "Your answers reached the score where this questionnaire suggests talking to a doctor or midwife soon. It is a questionnaire, not a diagnosis: they can look at it with you."
	case b == Amber && instrument == EPDS:
		return "Some of your answers are worth keeping an eye on. Take the questionnaire again in two weeks and mention how you have been feeling at your next visit."
	case b == Amber:
		return "Some of your answers are worth keeping an eye on. Mention how you have been feeling at your next visit and take the questionnaire again then."
	}
	return "Your answers are below the score where this questionnaire suggests a follow-up. If you keep feeling low for more than a week or two, talk to your doctor or midwife."
}

// ScreeningSample is one of the viewing parent's own questionnaires.
type ScreeningSample struct {
	At         time.Time
	Instrument string
	Score      int
	Band       Band
	Urgent     bool
}

// The well-baby visits where Bright Futures lists maternal depression
// screening, in months of the baby's age.
var screeningVisitMonths = []int{1, 2, 4, 6}

// screenEarlyDays: a questionnaire up to a week before a visit counts for it;
// the EPDS asks about the past 7 days.
const screenEarlyDays = 7

// screenDropDays: the item drops off this long after the last visit.
const screenDropDays = 30

func latestScreening(f Facts) *ScreeningSample {
	if len(f.MoodScreenings) == 0 {
		return nil
	}
	return &f.MoodScreenings[0] // newest first
}

// moodScreenRule asks the viewer for a questionnaire around each of the
// baby's 1, 2, 4 and 6 month visits, until they have taken one for it.
func moodScreenRule(f Facts) (Result, bool) {
	if (f.Stage != "postpartum" && f.Stage != "infant") || len(f.Children) == 0 {
		return Result{}, false
	}
	baby := f.Children[len(f.Children)-1] // oldest first
	var visit time.Time
	month := 0
	for _, m := range screeningVisitMonths {
		v := baby.BirthDate.AddDate(0, m, 0)
		if f.Today.Before(v.AddDate(0, 0, -screenEarlyDays)) {
			break
		}
		visit, month = v, m
	}
	if month == 0 || f.Today.After(visit.AddDate(0, 0, screenDropDays)) {
		return Result{}, false
	}
	if s := latestScreening(f); s != nil && !s.At.Before(visit.AddDate(0, 0, -screenEarlyDays)) {
		return Result{}, false
	}
	if f.Today.Before(visit) {
		by := visit
		return Result{Status: Upcoming, DueBy: &by, Reason: fmt.Sprintf("%s's %d-month visit is on the way, and a short mood questionnaire is suggested around it.", baby.Name, month)}, true
	}
	return Result{Status: Due, Reason: fmt.Sprintf("%s is %d months old and you have not taken a mood questionnaire since the %d-month visit window opened.", baby.Name, baby.AgeMonths(f.Today), month)}, true
}

// SuggestedInstrument is the questionnaire the viewer's plan asks for now.
func SuggestedInstrument(f Facts) (string, bool) {
	if _, ok := moodScreenRule(f); ok {
		return EPDS, true
	}
	return "", false
}

// How long the follow-up items stay after the questionnaire they come from.
const (
	screenRepeatDays = 14
	screenAmberDrop  = 60
	screenRedDrop    = 28
)

// repeatRule follows up the viewer's latest questionnaire when it was amber.
func repeatRule(instrument string) func(Facts) (Result, bool) {
	return func(f Facts) (Result, bool) {
		s := latestScreening(f)
		if s == nil || s.Instrument != instrument || s.Band != Amber || s.Urgent || f.Today.After(s.At.AddDate(0, 0, screenAmberDrop)) {
			return Result{}, false
		}
		in, _ := InstrumentByID(instrument)
		reason := fmt.Sprintf("Your questionnaire on %s scored %d of %d.", s.At.Format("Jan 2"), s.Score, in.MaxScore())
		if instrument != EPDS {
			return Result{Status: Upcoming, Reason: reason}, true
		}
		by := s.At.AddDate(0, 0, screenRepeatDays)
		st := Upcoming
		if !f.Today.Before(by) {
			st = Due
		}
		return Result{Status: st, DueBy: &by, Reason: reason}, true
	}
}

// talkRule follows up the viewer's latest questionnaire when it was red or
// the self-harm question was answered above its lowest value.
func talkRule(instrument string) func(Facts) (Result, bool) {
	return func(f Facts) (Result, bool) {
		s := latestScreening(f)
		if s == nil || s.Instrument != instrument || (s.Band != Red && !s.Urgent) || f.Today.After(s.At.AddDate(0, 0, screenRedDrop)) {
			return Result{}, false
		}
		if s.Urgent {
			return Result{Status: Due, Reason: fmt.Sprintf("On %s you said thoughts of harming yourself have come up. Please tell your doctor or midwife.", s.At.Format("Jan 2"))}, true
		}
		in, _ := InstrumentByID(instrument)
		return Result{Status: Due, Reason: fmt.Sprintf("Your questionnaire on %s scored %d of %d.", s.At.Format("Jan 2"), s.Score, in.MaxScore())}, true
	}
}

// These rules only read the viewer's own questionnaires.
var screeningRules = []Rule{
	{
		ID:       "mood-screen-mother",
		Title:    "Take a short mood questionnaire",
		Detail:   "How you feel matters as much as how the baby is doing. Pediatric well-baby visits at 1, 2, 4 and 6 months include a check on the mother's mood. The questionnaire takes about five minutes; your answers stay private unless you share them.",
		Category: MentalHealth,
		Audience: ForMother,
		Source:   srcBrightFuturesSchedule,
		Evaluate: moodScreenRule,
	},
	{
		ID:       "mood-screen-partner",
		Title:    "Partners too: take a short mood questionnaire",
		Detail:   "About one in ten dads goes through postpartum depression. The same five-minute questionnaire works for partners; your answers stay private unless you share them.",
		Category: MentalHealth,
		Audience: ForPartner,
		Source:   srcPSIDads,
		Evaluate: moodScreenRule,
	},
	{
		ID:       "epds-repeat",
		Title:    "Take the mood questionnaire again in two weeks",
		Detail:   "Some of your answers were worth keeping an eye on. Take it again two weeks after the last one and mention how you have been feeling at your next visit.",
		Category: MentalHealth,
		Audience: ForBoth,
		Source:   srcEPDSScoring,
		Evaluate: repeatRule(EPDS),
	},
	{
		ID:       "phq9-repeat",
		Title:    "Mention your mood at your next visit",
		Detail:   "Some of your answers were worth keeping an eye on. Mention how you have been feeling at your next visit and take the questionnaire again then.",
		Category: MentalHealth,
		Audience: ForBoth,
		Source:   srcPHQ9Scoring,
		Evaluate: repeatRule(PHQ9),
	},
	{
		ID:       "epds-talk-to-doctor",
		Title:    "Talk to your doctor or midwife about how you have been feeling",
		Detail:   "Your answers reached the score where the questionnaire suggests a closer look with a professional. It is not a diagnosis. Your OB, midwife or family doctor can help. Postpartum Support International HelpLine: call or text 1-800-944-4773.",
		Category: MentalHealth,
		Audience: ForBoth,
		Source:   srcEPDSScoring,
		Evaluate: talkRule(EPDS),
	},
	{
		ID:       "phq9-talk-to-doctor",
		Title:    "Talk to your doctor about how you have been feeling",
		Detail:   "Your answers reached the score where the questionnaire suggests a closer look with a professional. It is not a diagnosis. Your doctor can help you work out what would help.",
		Category: MentalHealth,
		Audience: ForBoth,
		Source:   srcPHQ9Scoring,
		Evaluate: talkRule(PHQ9),
	},
}
