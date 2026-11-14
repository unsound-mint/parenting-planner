package fertility

import "github.com/unsound-mint/parenting-planner/api/internal/rules"

// Symptoms a parent can log. A fixed list keeps the free text out of the
// chart and out of anything that is not the sealed note.
var Symptoms = map[string]bool{
	"cramps": true, "headache": true, "breast_tenderness": true, "bloating": true,
	"mood_change": true, "fatigue": true, "nausea": true, "fertile_mucus": true, "low_energy": true,
}

var (
	periodFlows = map[string]bool{"spotting": true, "light": true, "medium": true, "heavy": true}
	testResults = map[string]bool{"negative": true, "faint": true, "positive": true}
)

type Group string

const (
	Appointments  Group = "appointments"
	Vitamins      Group = "vitamins"
	Questions     Group = "questions"
	Vaccines      Group = "vaccines"
	Lifestyle     Group = "lifestyle"
	PartnerHealth Group = "partner_health"
)

// Audience is who sees an item: both parents each get their own copy to tick.
type Audience string

const (
	Both        Audience = "both"
	MotherOnly  Audience = "mother"
	PartnerOnly Audience = "partner"
)

func (a Audience) includes(role string) bool { return a == Both || string(a) == role }

// Item is one checklist line. The wording is plain and never diagnostic: each
// item points to a clinician for the personal part. Dayana owns the wording.
type Item struct {
	Key      string
	Group    Group
	Title    string
	Detail   string
	Audience Audience
	Source   rules.Source
}

// Items is the preconception checklist. Every source was opened on the date in
// its CheckedAt. Folic acid and MMR also appear as plan rules (internal/rules/planning.go);
// here they are things to tick off together, not a second reminder.
var Items = []Item{
	{"planning_visit", Appointments, "Book a planning visit", "Talk to your doctor or ob-gyn about planning a pregnancy, especially if you have a health condition or take any medicine.", MotherOnly, rules.SrcNHSTryingToGetPregnant},
	{"partner_visit", Appointments, "Book a check-up for your partner", "A partner with a health condition, who takes medicine, or who has a fertility concern should talk to their doctor too.", PartnerOnly, rules.SrcNHSTryingToGetPregnant},
	{"folic_acid", Vitamins, "Start folic acid", "At least 400 micrograms (mcg) of folic acid every day before and during early pregnancy. Ask your clinician which product and dose fit you.", MotherOnly, rules.SrcMedlineFolicAcid},
	{"medicine_review", Questions, "Ask about your medicines", "Do not stop any prescribed medicine on your own. Ask your doctor or pharmacist whether anything you take, including herbal remedies, needs a change before you try.", Both, rules.SrcNHSTryingToGetPregnant},
	{"question_list", Questions, "Write down your questions", "Questions for the visit: your family history, conditions, how long to try before asking for tests. Add them in Appointments so they go with you.", Both, rules.SrcNHSTryingToGetPregnant},
	{"mmr_check", Vaccines, "Check your MMR vaccine", "Getting up to date on vaccines before pregnancy protects you and your baby. Ask your doctor or pharmacist whether your MMR (measles, mumps and rubella) vaccine is due.", Both, rules.SrcMedlinePreconception},
	{"smoking", Lifestyle, "Plan to stop smoking", "Avoiding smoking, alcohol and drugs is part of getting ready for pregnancy. Your doctor can help you quit.", Both, rules.SrcMedlinePreconception},
	{"alcohol", Lifestyle, "Agree on alcohol", "Avoiding alcohol is part of getting ready for pregnancy. Talk about what that means for both of you, and ask your doctor for help if it is hard.", Both, rules.SrcMedlinePreconception},
	{"healthy_weight", Lifestyle, "Look at your weight with your doctor", "Trying to reach a healthy weight is part of getting ready for pregnancy. Ask your doctor what that means for you.", Both, rules.SrcMedlinePreconception},
}

// Find returns the item with that key.
func Find(key string) (Item, bool) {
	for _, it := range Items {
		if it.Key == key {
			return it, true
		}
	}
	return Item{}, false
}

// Sources shown with the overview.
var OverviewSources = []rules.Source{
	rules.SrcACOGFertilityAwareness,
	rules.SrcACOGEvaluatingInfertility,
}
