package missions

import (
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/content"
)

// Stage is where a family is for missions: planning, one of the trimesters,
// newborn (first months at home), baby (rest of the first year) and toddler
// (from one year on).
type Stage string

const (
	Planning Stage = "planning"
	Tri1     Stage = "first_trimester"
	Tri2     Stage = "second_trimester"
	Tri3     Stage = "third_trimester"
	Newborn  Stage = "newborn"
	Baby     Stage = "baby"
	Toddler  Stage = "toddler"
)

// Categories group missions; each one has its own sticker.
const (
	Meals    = "meals"
	Home     = "home"
	Gear     = "gear"
	Care     = "care"
	Learning = "learning"
	Rest     = "rest"
	Together = "together"
)

// Mission is a concrete, kind thing one parent can take on. Nothing here is
// graded: a mission has no deadline unless DueDays says when it is most useful,
// counted from the day it is taken.
type Mission struct {
	Key      string
	Stage    Stage
	Title    string
	Why      string
	Category string
	// Partner is true when the mission is written for the parent who is not
	// carrying the baby. Either parent can take any mission.
	Partner bool
	DueDays int
	// Source backs a mission that touches health; nil for plain errands.
	Source *content.Source
}

func src(title, url string) *content.Source {
	return &content.Source{Title: title, URL: url, CheckedAt: time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)}
}

// Sources were opened on their checked date; the same pages back the learning
// paths in internal/content.
var (
	srcCarSeat   = src("AAP HealthyChildren.org: Car Safety Seats, Information for Families", "https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Car-Safety-Seats-Information-for-Families.aspx")
	srcNewborns  = src("DOL EBSA: Protections for Newborns, Adopted Children, and New Parents", "https://www.dol.gov/node/63379")
	srcSafeSleep = src("NICHD Safe to Sleep: Ways to Reduce Baby's Risk", "https://safetosleep.nichd.nih.gov/reduce-risk/reduce")
	srcCrying    = src("CDC: About Abusive Head Trauma (coping with crying)", "https://www.cdc.gov/child-abuse-neglect/about/about-abusive-head-trauma.html")
	srcFamilyVax = src("CDC: Vaccines for Family and Caregivers", "https://www.cdc.gov/vaccines-pregnancy/about/vaccines-family-caregivers.html")
	srcFMLA      = src("DOL WHD Fact Sheet 28Q: Taking Leave for Birth, Placement and Bonding under the FMLA", "https://www.dol.gov/agencies/whd/fact-sheets/28q-taking-leave-for-birth-placement-child")
	srcPreconcep = src("HHS Office on Women's Health: Preconception health", "https://www.womenshealth.gov/pregnancy/you-get-pregnant/preconception-health")
	srcHearHer   = src("CDC Hear Her: Maternal Warning Signs", "https://www.cdc.gov/hearher/maternal-warning-signs/index.html")
	srcVisits    = src("NICHD: What Happens During Prenatal Visits", "https://www.nichd.nih.gov/health/topics/preconceptioncare/conditioninfo/prenatal-visits")
	srcHunger    = src("CDC: Signs Your Child is Hungry or Full", "https://www.cdc.gov/infant-toddler-nutrition/mealtime/signs-your-child-is-hungry-or-full.html")
	srcChoking   = src("CDC: Choking hazards for infants and toddlers", "https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/choking-hazards.html")
	srcPicky     = src("AAP HealthyChildren.org: 10 Tips for Parents of Picky Eaters", "https://www.healthychildren.org/English/ages-stages/toddler/nutrition/Pages/Picky-Eaters.aspx")
	srcPSIDads   = src("Postpartum Support International: Help for Dads", "https://www.postpartum.net/get-help/help-for-dads/")
)

// Catalog is in suggestion order within each stage. Keys are stored with
// picks: never rename or reuse one.
var Catalog = []Mission{
	// Planning
	{Key: "plan-cook-together", Stage: Planning, Title: "Cook one new dinner together", Category: Meals, Why: "A shared kitchen habit is easier to start now than at 3 a.m. with a newborn."},
	{Key: "plan-both-checkups", Stage: Planning, Title: "Book a check-up for each of you", Category: Care, Partner: true, DueDays: 14, Why: "Both of you can talk to a clinician about getting ready, including vaccines and medicines.", Source: srcPreconcep},
	{Key: "plan-dream-list", Stage: Planning, Title: "Write your dream list for the first year", Category: Together, Why: "Ten minutes, one page each, then swap. No wrong answers."},
	{Key: "plan-money-talk", Stage: Planning, Title: "Sit down with a coffee and look at leave and money", Category: Learning, Partner: true, Why: "Leave rules differ by employer. Knowing yours early keeps choices open.", Source: srcFMLA},
	{Key: "plan-family-vaccines", Stage: Planning, Title: "Check your vaccine records", Category: Care, Partner: true, DueDays: 21, Why: "Some vaccines protect a baby through the people around them. Ask your clinic what you are due for.", Source: srcFamilyVax},
	{Key: "plan-declutter", Stage: Planning, Title: "Clear one shelf or corner for baby things", Category: Home, Why: "Starting small makes the room for a baby feel real, not overwhelming."},

	// First trimester
	{Key: "t1-visit-notes", Stage: Tri1, Title: "Go to the first visit and take the notes", Category: Care, Partner: true, DueDays: 14, Why: "Two heads remember more. Write down what the clinician says and what to ask next time.", Source: srcVisits},
	{Key: "t1-easy-meals", Stage: Tri1, Title: "Stock the fridge with easy, plain foods", Category: Meals, Partner: true, DueDays: 7, Why: "Nausea and tiredness are common. Crackers, soup and cold fruit make a hard day softer."},
	{Key: "t1-take-over-chore", Stage: Tri1, Title: "Take one chore off the list for good", Category: Home, Partner: true, Why: "Pick the one that is hardest now, like the bins or the litter box, and own it."},
	{Key: "t1-announce-plan", Stage: Tri1, Title: "Decide together who you tell and when", Category: Together, Why: "It is your news. A short agreement now avoids awkward surprises."},
	{Key: "t1-learn-warning", Stage: Tri1, Title: "Read the pregnancy warning signs together", Category: Learning, Partner: true, Why: "Knowing when to call is calmer than searching at midnight. The Urgent help screen has the list.", Source: srcHearHer},

	// Second trimester
	{Key: "t2-tour", Stage: Tri2, Title: "Tour the hospital or birth center together", Category: Learning, Partner: true, Why: "Know where to park, which door to use at night and who to ask for. It makes the big day feel familiar."},
	{Key: "t2-nursery-corner", Stage: Tri2, Title: "Set up the sleep space and keep it bare", Category: Home, Partner: true, Why: "A firm flat sleep surface and an empty crib is the safe set-up. Build it now, enjoy it later.", Source: srcSafeSleep},
	{Key: "t2-babymoon", Stage: Tri2, Title: "Plan a babymoon day, near home", Category: Together, Why: "One last long day for just the two of you. A walk and a good lunch counts."},
	{Key: "t2-freezer-meals", Stage: Tri2, Title: "Cook a double batch and freeze half", Category: Meals, Partner: true, DueDays: 21, Why: "Six meals in the freezer by the third trimester means the first week needs no planning."},
	{Key: "t2-pediatrician", Stage: Tri2, Title: "Shortlist two pediatricians and ask about visits", Category: Care, Partner: true, DueDays: 30, Why: "The first newborn visit comes within days of the birth. Having a name saves a rushed call."},
	{Key: "t2-bump-photo", Stage: Tri2, Title: "Take a monthly bump photo together", Category: Together, Why: "You will both want these later. It takes one minute."},

	// Third trimester
	{Key: "t3-car-seat", Stage: Tri3, Title: "Install the car seat and get it checked", Category: Gear, Partner: true, DueDays: 21, Why: "Install it from the manual, then book a check with a certified child passenger safety technician (CPST), ideally before the baby comes. The AAP suggests expectant parents do exactly this.", Source: srcCarSeat},
	{Key: "t3-batch-cook", Stage: Tri3, Title: "Batch-cook 6 freezer meals", Category: Meals, Partner: true, DueDays: 21, Why: "Label them, stack them flat, and the first fortnight has dinner sorted."},
	{Key: "t3-night-plan", Stage: Tri3, Title: "Plan the night shifts together", Category: Rest, Partner: true, DueDays: 21, Why: "Agree who covers which nights before you are both exhausted. A written plan beats a 4 a.m. negotiation."},
	{Key: "t3-hospital-bag", Stage: Tri3, Title: "Pack your own hospital bag", Category: Gear, Partner: true, DueDays: 14, Why: "Snacks, charger, a change of clothes and the paperwork folder. Done once, forgotten happily."},
	{Key: "t3-newborn-class", Stage: Tri3, Title: "Take a newborn care class", Category: Learning, Partner: true, DueDays: 28, Why: "Holding, bathing, diapering and soothing are easier after you have practised on a doll."},
	{Key: "t3-insurance-plan", Stage: Tri3, Title: "Find out how to add the baby to your health insurance", Category: Home, Partner: true, DueDays: 21, Why: "With an employer plan you usually have 30 days after the birth to add the baby. Ask HR or your insurer for the form now, so it is a five minute job later.", Source: srcNewborns},
	{Key: "t3-leave-forms", Stage: Tri3, Title: "Hand in your leave request", Category: Home, Partner: true, DueDays: 14, Why: "Many employers ask for notice. Ask your HR what they need, and by when.", Source: srcFMLA},
	{Key: "t3-learn-swaddle", Stage: Tri3, Title: "Learn the swaddle", Category: Learning, Partner: true, Why: "A snug swaddle settles many newborns. Ask your nurse or pediatrician to show you, and skip weighted swaddles.", Source: srcSafeSleep},

	// Newborn
	{Key: "nb-night-shift", Stage: Newborn, Title: "Take one night shift this week", Category: Rest, Partner: true, DueDays: 7, Why: "One whole stretch of sleep is the best gift in the first weeks. Earplugs for the other parent, a bottle or a pumped feed for you."},
	{Key: "nb-meal-train", Stage: Newborn, Title: "Cook or order dinner for three nights", Category: Meals, Partner: true, DueDays: 7, Why: "Feeding the person who feeds the baby is real help. Add a friend to the list if you can."},
	{Key: "nb-diaper-station", Stage: Newborn, Title: "Set up a diaper station on each floor", Category: Home, Partner: true, DueDays: 3, Why: "Wipes, diapers and a change of clothes within arm's reach, so nobody carries a baby upstairs."},
	{Key: "nb-calm-plan", Stage: Newborn, Title: "Agree on your plan for when the crying gets too much", Category: Together, Why: "Put the baby down safely, step away, and hand over. Say it now, while you are both calm.", Source: srcCrying},
	{Key: "nb-visit-notes", Stage: Newborn, Title: "Go to the next baby visit and take the notes", Category: Care, Partner: true, Why: "Write down weight, feeding and sleep questions beforehand. Two sets of ears help.", Source: srcHunger},
	{Key: "nb-check-in", Stage: Newborn, Title: "Ask your partner how they are, and listen", Category: Together, Why: "Ten minutes, no fixing. If either of you feels low for more than a couple of weeks, talk to a clinician.", Source: srcPSIDads},
	{Key: "nb-add-baby-insurance", Stage: Newborn, Title: "Add the baby to your health insurance", Category: Home, Partner: true, DueDays: 14, Why: "With an employer plan you usually have 30 days from the birth to request it, and cover then starts at the birth date. Do it in the first fortnight.", Source: srcNewborns},
	{Key: "nb-laundry", Stage: Newborn, Title: "Own the laundry for two weeks", Category: Home, Partner: true, Why: "It never ends, and it is perfect to hand over."},

	// Baby (rest of the first year)
	{Key: "bb-first-foods", Stage: Baby, Title: "Plan the first spoonful together", Category: Meals, Why: "Look for the signs your baby is ready, pick a quiet moment and bring the camera.", Source: srcHunger},
	{Key: "bb-choking-class", Stage: Baby, Title: "Watch or take an infant choking and CPR class", Category: Learning, Partner: true, DueDays: 21, Why: "Both of you, and any caregiver. Knowing what to do is calming.", Source: srcChoking},
	{Key: "bb-babyproof", Stage: Baby, Title: "Babyproof one room", Category: Home, Partner: true, DueDays: 14, Why: "Outlets, corners and anything low that can be pulled. One room at a time is plenty."},
	{Key: "bb-night-swap", Stage: Baby, Title: "Swap who does the night wake-ups", Category: Rest, Partner: true, DueDays: 7, Why: "A fresh rota helps the one who has been doing most of them."},
	{Key: "bb-date", Stage: Baby, Title: "Plan a short date, even at home", Category: Together, Why: "An hour after bedtime, phones away. It counts."},
	{Key: "bb-sleep-space", Stage: Baby, Title: "Re-check the sleep space", Category: Gear, Partner: true, Why: "Bare, flat and firm still applies as the baby grows. Take out anything that crept in.", Source: srcSafeSleep},

	// Toddler
	{Key: "td-new-recipe", Stage: Toddler, Title: "Let your child pick and stir one dinner", Category: Meals, Why: "Helping is a gentle way in to new foods. Keep it relaxed and skip the pressure.", Source: srcPicky},
	{Key: "td-choke-check", Stage: Toddler, Title: "Check the snacks for choking hazards", Category: Care, Partner: true, Why: "Whole grapes, nuts and hard raw pieces are common culprits. Cut or swap what you can.", Source: srcChoking},
	{Key: "td-play-hour", Stage: Toddler, Title: "Take a whole play hour, phone away", Category: Together, Why: "Follow the child's lead. Floor time is the whole job."},
	{Key: "td-bedtime", Stage: Toddler, Title: "Own the bedtime routine for a week", Category: Rest, Partner: true, DueDays: 7, Why: "Same steps, same order. It gives the other parent an evening off."},
	{Key: "td-organize-toys", Stage: Toddler, Title: "Rotate the toys and put half away", Category: Home, Why: "Fewer toys out means calmer play, and the stored ones feel new next month."},
	{Key: "td-vaccine-check", Stage: Toddler, Title: "Book the next check-up and ask what is due", Category: Care, Partner: true, DueDays: 14, Why: "Ask the clinic about shots and growth. Bring your questions.", Source: srcFamilyVax},
}

// For returns a stage's missions in suggestion order.
func For(s Stage) []Mission {
	out := []Mission{}
	for _, m := range Catalog {
		if m.Stage == s {
			out = append(out, m)
		}
	}
	return out
}

// ByKey finds any mission, whatever the stage.
func ByKey(key string) (Mission, bool) {
	for _, m := range Catalog {
		if m.Key == key {
			return m, true
		}
	}
	return Mission{}, false
}

// StageOf maps the family's content state to a mission stage.
func StageOf(st content.State) Stage {
	switch st.Stage {
	case "planning", "trying":
		return Planning
	case "pregnancy":
		switch {
		case st.HasWeek && st.Week >= 28:
			return Tri3
		case st.HasWeek && st.Week >= 14:
			return Tri2
		case st.HasWeek:
			return Tri1
		}
		return Tri2
	case "postpartum":
		return Newborn
	case "infant":
		if st.HasChild && st.AgeMonths < 3 {
			return Newborn
		}
		return Baby
	}
	return Toddler
}
