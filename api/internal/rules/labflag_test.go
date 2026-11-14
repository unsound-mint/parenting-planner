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
