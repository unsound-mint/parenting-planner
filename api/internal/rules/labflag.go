package rules

import "strconv"

// LabFlagMessage is the only wording an out-of-range lab value gets. It never
// names a condition or a treatment.
const LabFlagMessage = "Outside the usual range. Discuss with your doctor."

// LabFlagBasis says where the range comes from: the reference range the lab
// reported with the result, stored on the row.
const LabFlagBasis = "Reference range reported with this lab result"

type LabDirection string

const (
	LabLow  LabDirection = "low"
	LabHigh LabDirection = "high"
)

// LabOutOfRange compares a value to its stored reference range. A value equal
// to a bound is in range; a missing bound is not checked. It returns false
// when the value is in range or there is no range.
func LabOutOfRange(value float64, low, high *float64) (LabDirection, bool) {
	switch {
	case low != nil && value < *low:
		return LabLow, true
	case high != nil && value > *high:
		return LabHigh, true
	}
	return "", false
}

// LabFlagReason explains a flag from the numbers alone: the value, the range
// stored with the result and which side it fell on. It never names a
// condition or advises anything.
func LabFlagReason(value float64, unit string, low, high *float64, dir LabDirection) string {
	num := func(v float64) string { return strconv.FormatFloat(v, 'f', -1, 64) }
	with := func(v float64) string {
		if unit == "" {
			return num(v)
		}
		return num(v) + " " + unit
	}
	side := "below"
	if dir == LabHigh {
		side = "above"
	}
	var rng string
	switch {
	case low != nil && high != nil:
		rng = num(*low) + " to " + with(*high)
	case low != nil:
		rng = "the range of at least " + with(*low)
	case high != nil:
		rng = "the range of up to " + with(*high)
	default:
		rng = "the stored range"
	}
	return "Because " + with(value) + " is " + side + " " + rng +
		", the reference range entered with this result. The flag only compares the two numbers; it is not a diagnosis."
}
