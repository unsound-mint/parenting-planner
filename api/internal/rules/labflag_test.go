package rules

import (
	"strings"
	"testing"
)

func TestLabOutOfRange(t *testing.T) {
	f := func(v float64) *float64 { return &v }
	for _, tc := range []struct {
		name      string
		value     float64
		low, high *float64
		want      LabDirection
		flagged   bool
	}{
		{"inside", 48, f(15), f(150), "", false},
		{"below", 9, f(15), f(150), LabLow, true},
		{"above", 210, f(125), f(200), LabHigh, true},
		{"equal to low", 15, f(15), f(150), "", false},
		{"equal to high", 150, f(15), f(150), "", false},
		{"only low, below", 20, f(30), nil, LabLow, true},
		{"only low, above it", 900, f(30), nil, "", false},
		{"only high, above", 5.1, nil, f(5), LabHigh, true},
		{"no range", 1000, nil, nil, "", false},
	} {
		got, ok := LabOutOfRange(tc.value, tc.low, tc.high)
		if got != tc.want || ok != tc.flagged {
			t.Errorf("%s: got (%q, %v), want (%q, %v)", tc.name, got, ok, tc.want, tc.flagged)
		}
	}
}

// The flag wording is fixed and never names a condition or a treatment.
func TestLabFlagWordingIsNotDiagnostic(t *testing.T) {
	msg := strings.ToLower(LabFlagMessage)
	if !strings.Contains(msg, "discuss with your doctor") {
		t.Errorf("message %q must point to the doctor", LabFlagMessage)
	}
	for _, w := range []string{"anemi", "deficien", "diagnos", "disease", "treat", "take ", "supplement", "you have"} {
		if strings.Contains(msg, w) {
			t.Errorf("message %q contains %q", LabFlagMessage, w)
		}
	}
}

func TestLabFlagReason(t *testing.T) {
	f := func(v float64) *float64 { return &v }
	for _, tc := range []struct {
		name      string
		value     float64
		low, high *float64
		dir       LabDirection
		want      string
	}{
		{"below a range", 24, f(30), f(100), LabLow,
			"Because 24 ng/mL is below 30 to 100 ng/mL, the reference range entered with this result. The flag only compares the two numbers; it is not a diagnosis."},
		{"above a range", 5.25, f(1), f(5), LabHigh,
			"Because 5.25 ng/mL is above 1 to 5 ng/mL, the reference range entered with this result. The flag only compares the two numbers; it is not a diagnosis."},
		{"only low", 20, f(30.5), nil, LabLow,
			"Because 20 ng/mL is below the range of at least 30.5 ng/mL, the reference range entered with this result. The flag only compares the two numbers; it is not a diagnosis."},
		{"only high", 120, nil, f(100), LabHigh,
			"Because 120 ng/mL is above the range of up to 100 ng/mL, the reference range entered with this result. The flag only compares the two numbers; it is not a diagnosis."},
	} {
		got := LabFlagReason(tc.value, "ng/mL", tc.low, tc.high, tc.dir)
		if got != tc.want {
			t.Errorf("%s:\n got %q\nwant %q", tc.name, got, tc.want)
		}
		lower := strings.ToLower(got)
		// "diagnos" is allowed once, in the closing "not a diagnosis" disclaimer.
		for _, w := range []string{"anemi", "deficien", "disease", "treat", "take ", "supplement", "you have"} {
			if strings.Contains(lower, w) {
				t.Errorf("%s: reason %q contains %q", tc.name, got, w)
			}
		}
		if strings.Count(lower, "diagnos") != 1 || !strings.HasSuffix(lower, "it is not a diagnosis.") {
			t.Errorf("%s: reason %q must only mention diagnosis in its disclaimer", tc.name, got)
		}
	}
}
