// Package content is the catalog of stage guides, weekly pregnancy cards and
// birth preparation modules. It is Go data, not tables: every entry cites a
// source that is listed, with its checked date, in docs/guidelines. Add
// content only from rows in those files that are not marked (verify), and add
// the row to the docs first if the source is new.
//
// The package is separate from internal/rules on purpose: rule wording is
// owned by product, this catalog is plain reference content.
package content

import (
	"slices"
	"time"
)

// Source is where a catalog entry comes from.
type Source struct {
	Title     string
	URL       string
	CheckedAt time.Time
}

type Kind string

const (
	Article   Kind = "article"
	BirthPrep Kind = "birth_prep"
)

// Audience tags. Parents are mother and partner; grandparents and nannies
// both read the caregiver tag.
type Audience string

const (
	Mother    Audience = "mother"
	Partner   Audience = "partner"
	Caregiver Audience = "caregiver"
)

// Range is an inclusive span of gestational weeks or child ages in months.
type Range struct{ From, To int }

func (r Range) contains(n int) bool { return n >= r.From && n <= r.To }

// BirthPrepUnlockWeek is the gestational week at which birth prep opens.
// Modules are listed from week 28 so a family can see what is coming.
const BirthPrepUnlockWeek = 32

type Guide struct {
	ID       string
	Kind     Kind
	Title    string
	Summary  string
	Steps    []string
	Minutes  int
	Stages   []string
	Weeks    *Range // pregnancy content
	Ages     *Range // child age in months, after birth
	Audience []Audience
	Source   Source
	// RuleID is the plan rule this guide explains (see actions.go); empty when no rule covers it.
	RuleID string
	// Action is the one thing an article ends in (see actions.go); nil for birth prep modules.
	Action *Action
}

// Viewer is the acting person.
type Viewer struct {
	// Role is mother, partner, grandparent or nanny.
	Role string
	// PregnancyUpdates is the grandparent permission of the same name.
	PregnancyUpdates bool
}

func (v Viewer) audience() Audience {
	switch v.Role {
	case "mother":
		return Mother
	case "partner":
		return Partner
	}
	return Caregiver
}

// MayReadPregnancy reports whether the viewer may see pregnancy content.
func (v Viewer) MayReadPregnancy() bool {
	switch v.Role {
	case "mother", "partner":
		return true
	case "grandparent":
		return v.PregnancyUpdates
	}
	return false
}

// State is what the family's stored data says today.
type State struct {
	Stage string
	// Week is the completed gestational week; HasWeek is false without a due date.
	Week    int
	HasWeek bool
	// AgeMonths is the youngest child's age; HasChild is false without a child.
	AgeMonths int
	HasChild  bool
}

// Entry is a guide as seen by one family.
type Entry struct {
	Guide
	Locked bool
}

// Guides returns the guides for this family and viewer, most relevant first:
// the entry whose window opened most recently comes first.
func Guides(s State, v Viewer, kind Kind) []Entry {
	if s.Stage == "pregnancy" && !v.MayReadPregnancy() {
		return []Entry{}
	}
	out := []Entry{}
	for _, g := range guides {
		if kind != "" && g.Kind != kind {
			continue
		}
		if !slices.Contains(g.Stages, s.Stage) || !slices.Contains(g.Audience, v.audience()) {
			continue
		}
		if g.Weeks != nil && (!s.HasWeek || !g.Weeks.contains(s.Week)) {
			continue
		}
		if g.Ages != nil && s.HasChild && !g.Ages.contains(s.AgeMonths) {
			continue
		}
		out = append(out, Entry{Guide: g, Locked: g.Kind == BirthPrep && s.Week < BirthPrepUnlockWeek})
	}
	slices.SortStableFunc(out, func(a, b Entry) int { return opened(b.Guide) - opened(a.Guide) })
	return out
}

func opened(g Guide) int {
	switch {
	case g.Weeks != nil:
		return g.Weeks.From
	case g.Ages != nil:
		return g.Ages.From
	}
	return 0
}

// All returns the whole catalog, for tests.
func All() []Guide { return slices.Clone(guides) }

func day(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

// checked is the date the docs record for every source below.
var checked = day(2026, 11, 14)

func src(title, url string) Source { return Source{Title: title, URL: url, CheckedAt: checked} }

var (
	srcUSPSTFFolic    = src("USPSTF: Folic Acid for the Prevention of Neural Tube Defects", "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/folic-acid-for-the-prevention-of-neural-tube-defects-preventive-medication")
	srcNICHDHealthy   = src("NICHD: Healthy Pregnancy", "https://www.nichd.nih.gov/health/topics/preconceptioncare/conditioninfo/healthy-pregnancy")
	srcNICHDVisits    = src("NICHD: What Happens During Prenatal Visits", "https://www.nichd.nih.gov/health/topics/preconceptioncare/conditioninfo/prenatal-visits")
	srcNICHDLabor     = src("NICHD: Start of Labor", "https://www.nichd.nih.gov/health/topics/labor-delivery/topicinfo/start-of-labor")
	srcASRM           = src("ASRM: Fertility Evaluation of Infertile Women, 2026", "https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2026/")
	srcMedlineDown    = src("MedlinePlus: Down Syndrome Tests", "https://medlineplus.gov/lab-tests/down-syndrome-tests/")
	srcHearHer        = src("CDC Hear Her: Maternal Warning Signs", "https://www.cdc.gov/hearher/maternal-warning-signs/index.html")
	srcUSPSTFGDM      = src("USPSTF: Gestational Diabetes, Screening", "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/gestational-diabetes-screening")
	srcCDCTdapPreg    = src("CDC: Vaccinating Pregnant Patients (pertussis)", "https://www.cdc.gov/pertussis/hcp/vaccine-recommendations/vaccinating-pregnant-patients.html")
	srcCDCFamilyVacc  = src("CDC: Vaccines for Family and Caregivers", "https://www.cdc.gov/vaccines-pregnancy/about/vaccines-family-caregivers.html")
	srcCDCRSV         = src("CDC RSV: Guidance for Pregnant People", "https://www.cdc.gov/rsv/hcp/vaccine-clinical-guidance/pregnant-people.html")
	srcCDCGBS         = src("CDC: Group B Strep Testing", "https://www.cdc.gov/group-b-strep/testing/index.html")
	srcDOLFMLA        = src("US DOL WHD: FMLA Fact Sheet 28", "https://www.dol.gov/agencies/whd/fact-sheets/28-fmla")
	srcDOLFMLA28Q     = src("DOL WHD: Fact Sheet 28Q, Taking Leave from Work for Birth, Placement, and Bonding with a Child under the FMLA", "https://www.dol.gov/agencies/whd/fact-sheets/28q-taking-leave-for-birth-placement-child")
	srcDOLNewborns    = src("DOL EBSA: Protections for Newborns, Adopted Children, and New Parents", "https://www.dol.gov/node/63379")
	srcDOLPumping     = src("DOL WHD: Fact Sheet 73, Break Time for Nursing Mothers under the FLSA", "https://www.dol.gov/agencies/whd/fact-sheets/73-flsa-break-time-nursing-mothers")
	srcCDCSleep       = src("CDC: About Sleep", "https://www.cdc.gov/sleep/about/index.html")
	srcPSIDads        = src("PSI: Help for Dads", "https://www.postpartum.net/get-help/help-for-dads/")
	srcFrontiers      = src("Frontiers in Psychology: Transition to Parenthood and Marital Satisfaction, A Meta-Analysis (2022)", "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.901362/full")
	srcBrightFutures  = src("Bright Futures: AAP periodicity schedule", "https://downloads.aap.org/aap/pdf/periodicity_schedule.pdf")
	srcBFEvidence     = src("Bright Futures: evidence and rationale", "https://downloads.aap.org/AAP/PDF/Bright%20Futures/BF4_Evidence_Rationale.pdf")
	srcCDCFoods       = src("CDC: foods and drinks to avoid or limit", "https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-avoid-or-limit.html")
	srcCDCMilestone9  = src("CDC: milestones at 9 months", "https://www.cdc.gov/act-early/milestones/9-months.html")
	srcCDCMilestone18 = src("CDC: milestones at 18 months", "https://www.cdc.gov/act-early/milestones/18-months.html")
	srcAASM           = src("AASM pediatric sleep consensus (2016)", "https://depts.washington.edu/dbpeds/pediatricsleepdurationconsensus.pdf")
	srcCDCBooster     = src("CDC: booster seat guide", "https://www.cdc.gov/child-passenger-safety/media/pdfs/Booster-Seat-Guide_508c.pdf")
	srcAAPDrowning    = src("AAP: drowning", "https://www.aap.org/drowning")
	srcAAPScreen      = src("AAP: Q&A on toddler screen time", "https://www.aap.org/en/patient-care/media-and-children/center-of-excellence-on-social-media-and-youth-mental-health/qa-portal/qa-portal-library/qa-portal-library-questions/reducing-screen-time-for-toddlers-cold-turkey-or-gradual-change/")
	srcUSPSTFVision   = src("USPSTF: Vision in Children Ages 6 Months to 5 Years, Screening", "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/vision-in-children-ages-6-months-to-5-years-screening")
	srcAAPSchedule    = src("AAP 2026 immunization schedule", "https://downloads.aap.org/AAP/PDF/AAP-Immunization-Schedule.pdf")
	srcNCES           = src("NCES: state kindergarten entrance table (2020)", "https://nces.ed.gov/programs/statereform/tab1_3-2020.asp")
	srcHHSActivity    = src("HHS Physical Activity Guidelines, 2nd ed.", "https://odphp.health.gov/our-work/physical-activity/current-guidelines/top-10-things-know")
	srcCDCAnxiety     = src("CDC: anxiety and depression in children", "https://www.cdc.gov/children-mental-health/about/about-anxiety-and-depression-in-children.html")
)

var (
	parents     = []Audience{Mother, Partner}
	everyone    = []Audience{Mother, Partner, Caregiver}
	motherOnly  = []Audience{Mother}
	partnerOnly = []Audience{Partner}
)

func weeks(from, to int) *Range { return &Range{from, to} }
func ages(from, to int) *Range  { return &Range{from, to} }

func st(s ...string) []string { return s }

var guides = []Guide{
	// Planning and trying.
	{ID: "planning-folic-acid", Kind: Article, Title: "Start folic acid before you conceive", Summary: "Take it daily from at least a month before conception.",
		Steps:   st("Take 400 to 800 mcg of folic acid every day, starting at least a month before conception.", "Keep taking it through the first 2 to 3 months of pregnancy.", "After an earlier pregnancy with a neural tube defect, ask your clinician about a higher dose."),
		Minutes: 2, Stages: st("planning", "trying"), Audience: motherOnly, Source: srcUSPSTFFolic},
	{ID: "planning-preconception-visit", Kind: Article, Title: "Book a preconception visit", Summary: "Review medicines, supplements, conditions and vaccines before you try.",
		Steps:   st("Book a visit with a clinician before you try to conceive.", "Bring a list of every medicine and supplement either of you takes.", "Ask which vaccines to update, and stop alcohol, tobacco and drugs."),
		Minutes: 3, Stages: st("planning", "trying"), Audience: parents, Source: srcNICHDHealthy},
	{ID: "trying-fertility-evaluation", Kind: Article, Title: "When to ask for a fertility evaluation", Summary: "The wait depends on age, and a known condition means no wait.",
		Steps:   st("Under 35: ask after 12 months of regular unprotected sex.", "35 or older: ask after 6 months.", "Over 40, or with a condition likely to cause infertility: ask from the start."),
		Minutes: 2, Stages: st("trying"), Audience: parents, Source: srcASRM},

	// Pregnancy.
	{ID: "preg-first-visit", Kind: Article, Title: "Book the first prenatal visit", Summary: "Book as soon as you suspect pregnancy, even after a home test.",
		Steps:   st("Call your OB or midwife to book the first visit.", "Expect blood type, blood count, urine tests and screening for hepatitis B, HIV, rubella and syphilis."),
		Minutes: 2, Stages: st("pregnancy"), Weeks: weeks(4, 13), Audience: parents, Source: srcNICHDVisits},
	{ID: "preg-screening-choices", Kind: Article, Title: "Choose your first-trimester screening", Summary: "Screening is optional; decide before weeks 10 to 13 pass.",
		Steps:   st("From week 10 you can have a cell-free DNA blood test.", "Weeks 10 to 13: a blood test plus a neck-fold ultrasound is the combined screen.", "Diagnostic testing such as CVS is a separate choice, weeks 10 to 13."),
		Minutes: 3, Stages: st("pregnancy"), Weeks: weeks(9, 19), Audience: parents, Source: srcMedlineDown},
	{ID: "preg-warning-signs", Kind: Article, Title: "Know the urgent warning signs", Summary: "Save the signs and who to call now, not when you need them.",
		Steps:   st("Get care at once for a headache that will not go away, vision changes, dizziness or fainting, or extreme swelling of the hands or face.", "Get care at once for vaginal bleeding, leaking fluid, or baby movement that stops or slows.", "Save your provider's after-hours number."),
		Minutes: 2, Stages: st("pregnancy"), Weeks: weeks(14, 42), Audience: everyone, Source: srcHearHer},
	{ID: "preg-glucose-screen", Kind: Article, Title: "Book the glucose test", Summary: "One screen at 24 weeks or later, unless you already have diabetes.",
		Steps:   st("Ask your OB to schedule the glucose screen.", "It is a one-time test at 24 weeks or later."),
		Minutes: 1, Stages: st("pregnancy"), Weeks: weeks(22, 30), Audience: motherOnly, Source: srcUSPSTFGDM},
	{ID: "preg-tdap", Kind: Article, Title: "Get Tdap in weeks 27 to 36", Summary: "One dose in every pregnancy, early in the window if you can.",
		Steps:   st("Book one Tdap dose in each pregnancy.", "Earlier in weeks 27 to 36 is preferred."),
		Minutes: 1, Stages: st("pregnancy"), Weeks: weeks(25, 36), Audience: motherOnly, Source: srcCDCTdapPreg},
	{ID: "preg-partner-vaccines", Kind: Article, Title: "Update your own vaccines", Summary: "Do it at least 2 weeks before you meet the baby.",
		Steps:   st("Get Tdap if you have not had a booster as a teen or adult.", "Get a flu shot each season.", "Do both at least 2 weeks before meeting the baby."),
		Minutes: 1, Stages: st("pregnancy"), Weeks: weeks(24, 40), Audience: partnerOnly, Source: srcCDCFamilyVacc},
	{ID: "preg-rsv", Kind: Article, Title: "Ask about the RSV vaccine", Summary: "One dose in weeks 32 to 36, in season.",
		Steps:   st("In September to January, ask for one RSV dose between weeks 32 and 36.", "It is not given after 36 weeks 6 days."),
		Minutes: 1, Stages: st("pregnancy"), Weeks: weeks(30, 36), Audience: motherOnly, Source: srcCDCRSV},
	{ID: "preg-gbs", Kind: Article, Title: "Get the group B strep swab", Summary: "Weeks 36 to 37, in every pregnancy, even when a cesarean is planned.",
		Steps:   st("Book the vaginal-rectal swab for weeks 36 to 37.", "It is repeated in each pregnancy."),
		Minutes: 1, Stages: st("pregnancy"), Weeks: weeks(34, 40), Audience: motherOnly, Source: srcCDCGBS},
	{ID: "preg-labor-signs", Kind: Article, Title: "Learn the signs of labor", Summary: "Know when to call and what to expect.",
		Steps:   st("Contractions that get stronger, longer and closer together, bloody show, pelvic pressure and backache are signs of labor.", "Call your provider when contractions come every 5 to 10 minutes for an hour.", "Call right away if fluid gushes or trickles."),
		Minutes: 2, Stages: st("pregnancy"), Weeks: weeks(36, 42), Audience: everyone, Source: srcNICHDLabor},

	// Birth preparation. Listed from week 28, locked until week 32.
	{ID: "birth-prep-labor-signs", Kind: BirthPrep, Title: "Labor signs and when to call", Summary: "What labor looks like and the numbers to act on.",
		Steps:   st("Regular contractions that grow stronger, longer and closer together are labor.", "Bloody show, pelvic pressure and backache can come with them.", "Call your provider when contractions come every 5 to 10 minutes for an hour, or when fluid gushes or trickles.", "Before 37 weeks, report regular or frequent contractions right away."),
		Minutes: 5, Stages: st("pregnancy"), Weeks: weeks(28, 42), Audience: parents, Source: srcNICHDLabor},
	{ID: "birth-prep-warning-signs", Kind: BirthPrep, Title: "Know where to go and who to call", Summary: "The urgent signs, for both of you, before the baby arrives.",
		Steps:   st("Read the CDC warning signs together, including those of preeclampsia.", "Agree where you would go and who calls whom.", "The same signs matter for the whole first year after birth."),
		Minutes: 5, Stages: st("pregnancy"), Weeks: weeks(28, 42), Audience: parents, Source: srcHearHer},
	{ID: "birth-prep-leave", Kind: BirthPrep, Title: "Check parental leave now", Summary: "Eligibility and notice, before leave starts.",
		Steps:   st("Check FMLA eligibility: 12 months with the employer, 1,250 hours in the past 12 months, 50 or more employees within 75 miles.", "Give notice as early as practical."),
		Minutes: 5, Stages: st("pregnancy"), Weeks: weeks(28, 42), Audience: parents, Source: srcDOLFMLA},

	// Postpartum.
	{ID: "postpartum-warning-signs", Kind: Article, Title: "Urgent warning signs after birth", Summary: "They matter through the first year, not only the first days.",
		Steps:   st("Get urgent care for a severe or worsening headache, vision changes, chest pain, trouble breathing, or thoughts of harming yourself or the baby.", "Call your provider urgently for a fever of 100.4 F or higher, extreme swelling of the hands or face, or severe belly pain that does not go away."),
		Minutes: 2, Stages: st("postpartum", "infant"), Ages: ages(0, 12), Audience: parents, Source: srcHearHer},
	{ID: "postpartum-baby-insurance", Kind: Article, Title: "Enroll the baby in health insurance", Summary: "Within 30 days on an employer plan.",
		Steps:   st("Enroll the baby in your employer health plan within 30 days, so coverage starts on the birth date.", "Buying through HealthCare.gov: the usual window is 60 days, so confirm yours with the marketplace."),
		Minutes: 2, Stages: st("postpartum", "infant"), Ages: ages(0, 2), Audience: parents, Source: srcDOLNewborns},
	{ID: "postpartum-leave", Kind: Article, Title: "Request your leave", Summary: "Up to 12 workweeks of FMLA bonding leave, for either parent.",
		Steps:   st("Request up to 12 workweeks of FMLA leave for the birth and bonding.", "Bonding leave must be taken within 12 months of birth.", "Spouses at the same employer share one combined 12 weeks; unmarried partners do not."),
		Minutes: 3, Stages: st("postpartum", "infant"), Ages: ages(0, 11), Audience: parents, Source: srcDOLFMLA28Q},
	{ID: "postpartum-night-shifts", Kind: Article, Title: "Plan night shifts so both of you sleep", Summary: "Each parent needs one long block.",
		Steps:   st("Split the night so each parent gets a long block of sleep.", "CDC advises adults to get at least 7 hours a night."),
		Minutes: 2, Stages: st("postpartum"), Ages: ages(0, 3), Audience: parents, Source: srcCDCSleep},
	{ID: "postpartum-partner-mood", Kind: Article, Title: "Check your own mood and sleep", Summary: "About one in ten dads has postpartum depression.",
		Steps:   st("About one in ten dads has postpartum depression, and 5 to 15 percent develop an anxiety disorder.", "Save the PSI HelpLine, 1-800-944-4773; a trained volunteer calls back."),
		Minutes: 2, Stages: st("postpartum", "infant"), Ages: ages(0, 12), Audience: partnerOnly, Source: srcPSIDads},
	{ID: "postpartum-couple-checkin", Kind: Article, Title: "Hold a short weekly check-in", Summary: "Chores, sleep and money, 10 minutes.",
		Steps:   st("Relationship satisfaction declines from pregnancy to 12 months after birth, so talk about chores, sleep and money on a regular schedule."),
		Minutes: 2, Stages: st("postpartum", "infant"), Ages: ages(0, 12), Audience: parents, Source: srcFrontiers},
	{ID: "postpartum-newborn-visit", Kind: Article, Title: "The first newborn visit", Summary: "3 to 5 days after birth, within 48 to 72 hours of discharge.",
		Steps:   st("Book the first visit for 3 to 5 days after birth.", "The visit checks feeding, jaundice and the newborn screen results.", "Ask for breastfeeding support if you are nursing."),
		Minutes: 2, Stages: st("postpartum"), Ages: ages(0, 1), Audience: parents, Source: srcBrightFutures},
	{ID: "postpartum-pumping-at-work", Kind: Article, Title: "Plan pumping at work", Summary: "Ask for break time and a private space before you return.",
		Steps:   st("Ask your employer for break time and a private space to pump; it must not be a bathroom.", "The right continues for up to one year after birth."),
		Minutes: 2, Stages: st("postpartum", "infant"), Ages: ages(1, 12), Audience: motherOnly, Source: srcDOLPumping},

	// Infant.
	{ID: "infant-no-honey", Kind: Article, Title: "What not to feed before 12 months", Summary: "No honey, cow's milk as a drink, or juice.",
		Steps:   st("No honey in any form before 12 months.", "No cow's milk as a drink before 12 months.", "No fruit or vegetable juice before 12 months."),
		Minutes: 1, Stages: st("infant"), Ages: ages(0, 11), Audience: everyone, Source: srcCDCFoods},
	{ID: "infant-milestones-9m", Kind: Article, Title: "The 9 month visit and milestone check", Summary: "Developmental screening with a validated tool.",
		Steps:   st("Book the 9 month well visit; it includes developmental screening.", "Check the CDC 9 month milestone list and bring questions."),
		Minutes: 3, Stages: st("infant"), Ages: ages(7, 11), Audience: parents, Source: srcCDCMilestone9},
	{ID: "infant-dental-home", Kind: Article, Title: "Find a dentist by 12 months", Summary: "Referral from 6 months, first visit no later than 12.",
		Steps:   st("Book the first dental visit between 6 and 12 months.", "Fluoride varnish starts once the first tooth comes in."),
		Minutes: 1, Stages: st("infant"), Ages: ages(6, 11), Audience: parents, Source: srcBFEvidence},

	// Toddler.
	{ID: "toddler-18m-visit", Kind: Article, Title: "The 18 month visit", Summary: "Developmental and autism screening.",
		Steps:   st("Book the 18 month visit; it includes developmental screening and autism screening.", "Check the CDC 18 month milestone list and bring questions."),
		Minutes: 3, Stages: st("toddler"), Ages: ages(15, 20), Audience: parents, Source: srcCDCMilestone18},
	{ID: "toddler-sleep", Kind: Article, Title: "Sleep a toddler needs", Summary: "11 to 14 hours a day at age 2, naps included.",
		Steps:   st("Age 2: 11 to 14 hours in 24 hours, naps included.", "From age 3: 10 to 13 hours.", "Ask the pediatrician about frequent snoring or trouble sleeping."),
		Minutes: 1, Stages: st("toddler"), Ages: ages(12, 36), Audience: everyone, Source: srcAASM},
	{ID: "toddler-car-seat", Kind: Article, Title: "Keep the car seat rear-facing", Summary: "As long as the seat allows.",
		Steps:   st("Keep the child rear-facing as long as the seat's limits allow.", "Then move to a forward-facing harness seat with a top tether."),
		Minutes: 1, Stages: st("toddler"), Ages: ages(12, 36), Audience: everyone, Source: srcCDCBooster},
	{ID: "toddler-water-safety", Kind: Article, Title: "Water safety", Summary: "Drowning is the leading cause of death for ages 1 to 4.",
		Steps:   st("Name one adult as the water watcher whenever the child is near water.", "Stop unsupervised access to water."),
		Minutes: 1, Stages: st("toddler", "preschool"), Ages: ages(12, 71), Audience: everyone, Source: srcAAPDrowning},
	{ID: "toddler-screen-time", Kind: Article, Title: "Screen time for toddlers", Summary: "Under an hour a day, good content, watched together.",
		Steps:   st("AAP's Q&A says to keep toddler and preschool viewing under one hour a day.", "Choose high-quality, child-centered content and watch together."),
		Minutes: 1, Stages: st("toddler", "preschool"), Ages: ages(12, 71), Audience: everyone, Source: srcAAPScreen},

	// Preschool.
	{ID: "preschool-vision", Kind: Article, Title: "Get a vision screen between 3 and 5", Summary: "At least once, to catch amblyopia early.",
		Steps:   st("Ask for a visual acuity test at a well visit between ages 3 and 5."),
		Minutes: 1, Stages: st("preschool"), Ages: ages(36, 71), Audience: parents, Source: srcUSPSTFVision},
	{ID: "preschool-boosters", Kind: Article, Title: "Boosters at 4 to 6 years", Summary: "DTaP, polio, MMR and varicella second doses.",
		Steps:   st("Between 4 and 6 years: DTaP fifth dose and IPV fourth dose.", "MMR second dose and varicella second dose.", "Flu vaccine every year."),
		Minutes: 2, Stages: st("preschool"), Ages: ages(48, 71), Audience: parents, Source: srcAAPSchedule},
	{ID: "preschool-kindergarten", Kind: Article, Title: "Check the kindergarten cutoff date", Summary: "Each state sets a date by which the child must turn 5.",
		Steps:   st("43 states set a date by which a child must turn 5; September 1 is the most common.", "Check your district's enrollment calendar."),
		Minutes: 2, Stages: st("preschool"), Ages: ages(42, 71), Audience: parents, Source: srcNCES},
	{ID: "preschool-sleep-activity", Kind: Article, Title: "Sleep and active play", Summary: "10 to 13 hours of sleep, at least 3 hours of active play.",
		Steps:   st("Sleep 10 to 13 hours in 24 hours, naps included.", "Encourage active play through the day, at least 3 hours."),
		Minutes: 1, Stages: st("preschool"), Ages: ages(36, 71), Audience: everyone, Source: srcHHSActivity},
	{ID: "preschool-car-seat", Kind: Article, Title: "Forward-facing harness seat", Summary: "Until the child reaches the seat's limit.",
		Steps:   st("Use a forward-facing harness seat until the child reaches its height or weight limit.", "Then move to a booster seat."),
		Minutes: 1, Stages: st("preschool"), Ages: ages(36, 71), Audience: everyone, Source: srcCDCBooster},

	// School age.
	{ID: "school-yearly-visit", Kind: Article, Title: "Yearly well-child visit", Summary: "Growth, vision and hearing, behavior, vaccines.",
		Steps:   st("Book one well visit a year at ages 6 to 9.", "It covers height, weight, BMI, blood pressure, vision and hearing risk, a behavioral screen and an immunization review."),
		Minutes: 2, Stages: st("school_age"), Ages: ages(72, 107), Audience: parents, Source: srcBrightFutures},
	{ID: "school-sleep-activity", Kind: Article, Title: "Sleep and activity", Summary: "9 to 12 hours of sleep, 60 minutes of movement.",
		Steps:   st("Sleep 9 to 12 hours in 24 hours on a regular basis.", "Move at least 60 minutes a day, mostly aerobic, with muscle and bone strengthening at least 3 days a week."),
		Minutes: 1, Stages: st("school_age"), Ages: ages(72, 107), Audience: everyone, Source: srcHHSActivity},
	{ID: "school-anxiety", Kind: Article, Title: "When to ask about worry or low mood", Summary: "Raise it with the pediatrician when it lasts or gets in the way.",
		Steps:   st("Ask the pediatrician about worry or fear that does not fade, gets in the way of school or play, or comes with stomachaches or headaches without a medical cause.", "Ask about sadness, irritability or loss of interest lasting more than about two weeks.", "For thoughts of self-harm or suicide, call or text 988 now."),
		Minutes: 3, Stages: st("school_age"), Ages: ages(72, 107), Audience: parents, Source: srcCDCAnxiety},
	{ID: "school-booster-seat", Kind: Article, Title: "Booster seat until the belt fits", Summary: "Back seat until age 13.",
		Steps:   st("Use a booster seat until the lap belt sits across the upper thighs and the shoulder belt across the chest.", "That usually happens at 9 to 12 years.", "Keep children in the back seat until age 13."),
		Minutes: 1, Stages: st("school_age"), Ages: ages(72, 107), Audience: everyone, Source: srcCDCBooster},
}
