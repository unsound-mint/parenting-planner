package rules

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
