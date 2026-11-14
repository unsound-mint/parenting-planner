package health

import "strings"

// The screening catalog: the one list of screenings a parent can log, grouped
// by the stage they are usually offered at. It is a list to log against (what
// a clinic hands back), not a recommendation: nothing here says who should get
// which test or when. The plan reads only a few of these keys (glucose_screen
// and gbs in pregnancy, vision_screen for a child), through internal/rules.
//
// Keys are stable: they are stored in lab_results.kind. Rename a name freely,
// never a key.

// ScreeningOther is the kind for a screening that is not in the catalog; its
// free-text name is stored with it.
const ScreeningOther = "other"

type ScreeningOption struct{ Kind, Name string }

type ScreeningGroup struct {
	Label   string
	Options []ScreeningOption
}

type childScreening struct {
	ScreeningOption
	// FromMonths is the youngest age the screening is usually done at; a
	// younger child's list leaves it out.
	FromMonths int
}

var pregnancyScreenings = []ScreeningOption{
	{"blood_type_rh", "Blood type and Rh factor"},
	{"antibody_screen", "Antibody screen"},
	{"cbc", "Complete blood count"},
	{"rubella_immunity", "Rubella immunity"},
	{"varicella_immunity", "Chickenpox immunity"},
	{"hepatitis_b", "Hepatitis B test"},
	{"hepatitis_c", "Hepatitis C test"},
	{"hiv", "HIV test"},
	{"syphilis", "Syphilis test"},
	{"chlamydia_gonorrhea", "Chlamydia and gonorrhea test"},
	{"urine_test", "Urine test"},
	{"dating_ultrasound", "Dating ultrasound"},
	{"carrier_screen", "Carrier screening"},
	{"first_trimester_screen", "First-trimester screen (NT scan)"},
	{"cell_free_dna", "Cell-free DNA (NIPT)"},
	{"quad_screen", "Quad screen"},
	{"anatomy_scan", "Anatomy scan"},
	{"glucose_screen", "Glucose screening"},
	{"glucose_tolerance", "Glucose tolerance test"},
	{"gbs", "Group B strep test"},
	{"growth_ultrasound", "Growth ultrasound"},
	{"non_stress_test", "Non-stress test"},
}

var afterBirthScreenings = []ScreeningOption{
	{"postpartum_depression", "Postpartum depression screen"},
	{"postpartum_blood_pressure", "Blood pressure check after birth"},
	{"postpartum_glucose", "Glucose test after gestational diabetes"},
}

var adultScreenings = []ScreeningOption{
	{"blood_pressure", "Blood pressure"},
	{"cholesterol", "Cholesterol test"},
	{"diabetes_screen", "Diabetes screening (A1C)"},
	{"thyroid_tsh", "Thyroid test (TSH)"},
	{"depression_screen", "Depression screen"},
	{"anxiety_screen", "Anxiety screen"},
	{"hepatitis_c", "Hepatitis C test"},
	{"hiv", "HIV test"},
	{"dental_check", "Dental check"},
	{"eye_exam", "Eye exam"},
	{"skin_check", "Skin check"},
}

// Only on the mother's list.
var cervicalScreen = ScreeningOption{"cervical_screen", "Cervical screening (Pap or HPV test)"}

var childGroups = []struct {
	Label   string
	Options []childScreening
}{
	{"Newborn", []childScreening{
		{ScreeningOption{"newborn_blood_spot", "Newborn blood spot screen"}, 0},
		{ScreeningOption{"newborn_hearing", "Newborn hearing screen"}, 0},
		{ScreeningOption{"newborn_heart", "Newborn heart screen (pulse oximetry)"}, 0},
		{ScreeningOption{"bilirubin", "Bilirubin (jaundice) check"}, 0},
	}},
	{"Baby and toddler", []childScreening{
		{ScreeningOption{"developmental_screen", "Developmental screen"}, 6},
		{ScreeningOption{"dental_check", "Dental check"}, 6},
		{ScreeningOption{"hemoglobin_check", "Hemoglobin (anemia) check"}, 9},
		{ScreeningOption{"lead_test", "Lead test"}, 9},
		{ScreeningOption{"tuberculosis_risk", "Tuberculosis test"}, 9},
		{ScreeningOption{"autism_screen", "Autism screen (M-CHAT)"}, 18},
	}},
	{"Preschool and school age", []childScreening{
		{ScreeningOption{"vision_screen", "Vision screening"}, 36},
		{ScreeningOption{"hearing_screen", "Hearing screening"}, 36},
		{ScreeningOption{"blood_pressure", "Blood pressure"}, 36},
		{ScreeningOption{"cholesterol", "Cholesterol test"}, 108},
	}},
}

var otherGroup = ScreeningGroup{Label: "Something else", Options: []ScreeningOption{{ScreeningOther, "Other (type the name)"}}}

// Who a screening list is for.
type ScreeningSubject struct {
	Child     bool
	AgeMonths int
	// Mother is true for the parent with role mother.
	Mother bool
	// Stage is the family stage (pregnancy, postpartum, infant, ...).
	Stage string
}

// ScreeningOptions is the grouped list for one person: the group of their
// current stage first, a kind never twice, and "other" last. A child's list
// stops at their age, so a newborn is not offered a school vision screen.
func ScreeningOptions(s ScreeningSubject) []ScreeningGroup {
	var groups []ScreeningGroup
	if s.Child {
		for _, g := range childGroups {
			var opts []ScreeningOption
			for _, o := range g.Options {
				if s.AgeMonths >= o.FromMonths {
					opts = append(opts, o.ScreeningOption)
				}
			}
			if len(opts) > 0 {
				groups = append(groups, ScreeningGroup{Label: g.Label, Options: opts})
			}
		}
		// The current stage first: the newest group the child has reached.
		for i, j := 0, len(groups)-1; i < j; i, j = i+1, j-1 {
			groups[i], groups[j] = groups[j], groups[i]
		}
	} else {
		pregnant := s.Stage == "pregnancy"
		afterBirth := s.Stage == "postpartum" || s.Stage == "infant"
		adult := ScreeningGroup{Label: "General health", Options: adultScreenings}
		if s.Mother {
			adult.Options = append([]ScreeningOption{cervicalScreen}, adultScreenings...)
		}
		switch {
		case s.Mother && pregnant:
			groups = []ScreeningGroup{{"Pregnancy", pregnancyScreenings}, adult}
		case s.Mother && afterBirth:
			groups = []ScreeningGroup{{"After the birth", afterBirthScreenings}, {"Pregnancy", pregnancyScreenings}, adult}
		default:
			groups = []ScreeningGroup{adult}
		}
	}
	return append(dedupe(groups), otherGroup)
}

func dedupe(groups []ScreeningGroup) []ScreeningGroup {
	seen := map[string]bool{}
	out := make([]ScreeningGroup, 0, len(groups))
	for _, g := range groups {
		var opts []ScreeningOption
		for _, o := range g.Options {
			if !seen[o.Kind] {
				seen[o.Kind] = true
				opts = append(opts, o)
			}
		}
		if len(opts) > 0 {
			out = append(out, ScreeningGroup{Label: g.Label, Options: opts})
		}
	}
	return out
}

var screeningNames = func() map[string]string {
	m := map[string]string{}
	add := func(opts []ScreeningOption) {
		for _, o := range opts {
			if _, ok := m[o.Kind]; !ok {
				m[o.Kind] = o.Name
			}
		}
	}
	add(pregnancyScreenings)
	add(afterBirthScreenings)
	add(adultScreenings)
	add([]ScreeningOption{cervicalScreen})
	for _, g := range childGroups {
		for _, o := range g.Options {
			add([]ScreeningOption{o.ScreeningOption})
		}
	}
	return m
}()

// KnownScreening reports whether kind is in the catalog (any stage).
func KnownScreening(kind string) bool {
	_, ok := screeningNames[kind]
	return ok
}

// ScreeningName is the name shown for a stored screening: its own name when
// it has one (kind other), the catalog name, or the kind made readable for
// panels seeded before the catalog existed.
func ScreeningName(kind string, name *string) string {
	if name != nil && strings.TrimSpace(*name) != "" {
		return *name
	}
	if n, ok := screeningNames[kind]; ok {
		return n
	}
	n := strings.ReplaceAll(kind, "_", " ")
	if n == "" {
		return "Screening"
	}
	return strings.ToUpper(n[:1]) + n[1:]
}
