package health

import "testing"

func kinds(groups []ScreeningGroup) map[string]bool {
	out := map[string]bool{}
	for _, g := range groups {
		for _, o := range g.Options {
			out[o.Kind] = true
		}
	}
	return out
}

func TestScreeningOptions(t *testing.T) {
	mom := ScreeningOptions(ScreeningSubject{Mother: true, Stage: "pregnancy"})
	if mom[0].Label != "Pregnancy" || !kinds(mom[:1])["glucose_screen"] || !kinds(mom[:1])["gbs"] {
		t.Errorf("pregnant mother's first group = %+v", mom[0])
	}

	baby := kinds(ScreeningOptions(ScreeningSubject{Child: true, AgeMonths: 2}))
	if baby["vision_screen"] || baby["autism_screen"] || !baby["newborn_hearing"] {
		t.Errorf("2-month-old options = %v", baby)
	}
	if !kinds(ScreeningOptions(ScreeningSubject{Child: true, AgeMonths: 48}))["vision_screen"] {
		t.Error("a 4-year-old must be offered vision_screen")
	}

	for name, s := range map[string]ScreeningSubject{
		"mother pregnant": {Mother: true, Stage: "pregnancy"},
		"mother after":    {Mother: true, Stage: "infant"},
		"partner":         {Stage: "infant"},
		"newborn":         {Child: true},
		"4 years":         {Child: true, AgeMonths: 48},
		"10 years":        {Child: true, AgeMonths: 120},
	} {
		groups := ScreeningOptions(s)
		last := groups[len(groups)-1].Options
		if last[len(last)-1].Kind != ScreeningOther {
			t.Errorf("%s: list does not end with other", name)
		}
		seen := map[string]bool{}
		for _, g := range groups {
			for _, o := range g.Options {
				if seen[o.Kind] {
					t.Errorf("%s: kind %s listed twice", name, o.Kind)
				}
				seen[o.Kind] = true
			}
		}
	}
}
