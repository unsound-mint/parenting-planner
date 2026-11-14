package supplies

// Size suggestions are retail conventions, not health guidance: brands differ
// and babies grow at their own pace. They are always shown as approximate.
// The thresholds are the usual US infant size charts (clothing by age and
// weight, diapers by weight).

// SizeNote is shown next to every suggestion.
const SizeNote = "Approximate. Brands run differently, and babies grow at their own pace. If your baby is between sizes, the bigger one usually fits for longer."

var clothingSizes = []struct {
	label        string
	upToMonths   int     // exclusive; age at which the next size starts
	upToWeightKg float64 // exclusive; 0 = no weight rule
}{
	{"Newborn", 1, 3.6},
	{"0-3 months", 3, 5.7},
	{"3-6 months", 6, 7.7},
	{"6-9 months", 9, 9.5},
	{"9-12 months", 12, 10.9},
	{"12-18 months", 18, 12.2},
	{"18-24 months", 24, 13.6},
	{"2T", 36, 0},
	{"3T", 48, 0},
	{"4T", 60, 0},
}

// Suggest returns the clothing size, the diaper size and what they are based
// on. weightKg is 0 when no weight is on record. Under 2 years a higher weight
// bumps the size up; age alone is used otherwise.
func Suggest(ageMonths int, weightKg float64) (clothing, diaper, basis string) {
	if ageMonths < 0 {
		ageMonths = 0
	}
	byAge := len(clothingSizes) // index past the last = "5T and up"
	for i, s := range clothingSizes {
		if ageMonths < s.upToMonths {
			byAge = i
			break
		}
	}
	idx, basis := byAge, "age"
	if weightKg > 0 && ageMonths < 24 {
		byWeight := len(clothingSizes) - 3 // 2T
		for i, s := range clothingSizes {
			if s.upToWeightKg > 0 && weightKg < s.upToWeightKg {
				byWeight = i
				break
			}
		}
		if byWeight > idx {
			idx, basis = byWeight, "weight"
		}
	}
	clothing = "5T and up"
	if idx < len(clothingSizes) {
		clothing = clothingSizes[idx].label
	}
	return clothing, diaperSize(ageMonths, weightKg), basis
}

func diaperSize(ageMonths int, weightKg float64) string {
	if weightKg > 0 {
		for _, s := range []struct {
			label string
			upTo  float64
		}{{"Newborn", 4.5}, {"Size 1", 6}, {"Size 2", 8.5}, {"Size 3", 12.5}, {"Size 4", 16}, {"Size 5", 20}} {
			if weightKg < s.upTo {
				return s.label
			}
		}
		return "Size 6"
	}
	switch {
	case ageMonths < 1:
		return "Newborn"
	case ageMonths < 3:
		return "Size 1"
	case ageMonths < 6:
		return "Size 2"
	case ageMonths < 12:
		return "Size 3"
	case ageMonths < 24:
		return "Size 4"
	case ageMonths < 36:
		return "Size 5"
	}
	return "Size 6"
}
