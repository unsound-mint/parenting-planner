package content

import "strings"

// ActionKind is the one thing a lesson ends in.
type ActionKind string

const (
	AddTask     ActionKind = "add_task"
	AskAtVisit  ActionKind = "ask_at_visit"
	CommitShift ActionKind = "commit_shift"
	Practice    ActionKind = "practice"
)

// Shift is the shift a commit_shift action suggests; it is posted to createShift as is or edited.
type Shift struct {
	Title     string
	Days      []string
	StartTime string
	EndTime   string
}

// Action is what the "do it" button of a lesson does. add_task needs Title,
// ask_at_visit needs Question, commit_shift needs Shift; Label overrides the
// default button text.
type Action struct {
	Kind     ActionKind
	Label    string
	Title    string
	Question string
	Shift    *Shift
}

func task(title string) *Action   { return &Action{Kind: AddTask, Title: title} }
func ask(question string) *Action { return &Action{Kind: AskAtVisit, Question: question} }
func practice() *Action           { return &Action{Kind: Practice} }

var everyDay = []string{"mon", "tue", "wed", "thu", "fri", "sat", "sun"}

// actions is the one action of every article guide, by guide id. It was the table in
// web/src/lib/learn.ts; the guides without an entry ask about their own title.
var actions = map[string]*Action{
	"planning-folic-acid":          task("Start taking folic acid daily"),
	"planning-preconception-visit": task("Book a preconception visit"),
	"trying-fertility-evaluation":  ask("When should we ask for a fertility evaluation, given our ages?"),
	"preg-first-visit":             task("Book the first prenatal visit"),
	"preg-screening-choices":       ask("Which first-trimester screening do you recommend for us?"),
	"preg-warning-signs":           practice(),
	"preg-glucose-screen":          task("Book the glucose test"),
	"preg-tdap":                    task("Get the Tdap vaccine"),
	"preg-partner-vaccines":        task("Check my own vaccines"),
	"preg-rsv":                     ask("Is the RSV vaccine right for me this season?"),
	"preg-gbs":                     ask("When is the group B strep swab, and what happens if it is positive?"),
	"preg-labor-signs":             practice(),
	"postpartum-warning-signs":     practice(),
	"postpartum-baby-insurance":    task("Enroll the baby in health insurance"),
	"postpartum-leave":             task("Request parental leave"),
	"postpartum-night-shifts": {
		Kind: CommitShift, Label: "Take 22:00 to 02:00",
		Shift: &Shift{Title: "Night shift with the baby", Days: everyDay, StartTime: "22:00", EndTime: "02:00"},
	},
	"postpartum-partner-mood":    task("Do a mood and sleep check-in for myself"),
	"postpartum-couple-checkin":  task("Hold a 10 minute check-in this week"),
	"postpartum-newborn-visit":   ask("What should we bring and ask at the first newborn visit?"),
	"postpartum-pumping-at-work": task("Ask work for pumping breaks and a private space"),
	"infant-milestones-9m":       ask("Which developmental screening tool will you use at 9 months?"),
	"infant-dental-home":         task("Find a dentist for the baby"),
	"toddler-18m-visit":          ask("What does the developmental and autism screening at 18 months involve?"),
	"toddler-car-seat":           task("Check the car seat is rear-facing and fits"),
	"toddler-water-safety":       task("Sign up for water safety lessons"),
	"toddler-screen-time":        task("Agree on screen time with my partner"),
	"preschool-vision":           task("Book a vision screen"),
	"preschool-boosters":         task("Book the 4 to 6 year boosters"),
	"preschool-kindergarten":     task("Check the kindergarten cutoff date"),
	"preschool-car-seat":         task("Check the car seat fit"),
	"school-yearly-visit":        task("Book the yearly well-child visit"),
	"school-booster-seat":        task("Check the booster seat fit"),
}

// ruleIDs says which plan rule a guide explains, by guide id, using the id the rule has in
// internal/rules (the same as PlanItem.ruleId). A guide is listed only when a rule covers
// the same topic; the rest have none. A guide whose rule is already a plan item is not shown
// again as a lesson.
var ruleIDs = map[string]string{
	"planning-folic-acid":   "folic-acid",
	"preg-glucose-screen":   "glucose-screen",
	"preg-tdap":             "tdap-pregnancy",
	"preg-partner-vaccines": "tdap-partner",
	"preg-gbs":              "gbs-screen",
	"preschool-vision":      "vision-screen",
	"preschool-boosters":    "preschool-boosters",
}

func init() {
	for i := range guides {
		g := &guides[i]
		g.RuleID = ruleIDs[g.ID]
		if g.Kind != Article {
			continue // birth prep modules are practiced, not turned into one action
		}
		if a, ok := actions[g.ID]; ok {
			g.Action = a
		} else {
			// The default: put a question about the topic on the next visit.
			g.Action = ask("Ask about: " + strings.ToLower(g.Title))
		}
	}
}
