package health

import "testing"

func TestResultSummary(t *testing.T) {
	got := ResultSummary([]byte(`{"hemoglobin_g_dl": 13.1, "blood_type": "A+", "rubella": "not immune", "varicella": "immune", "tsh_miu_l": 1.8}`))
	want := "Rubella: not immune · Varicella: immune · Hemoglobin 13.1 g/dL · TSH 1.8 mIU/L · Blood type: A+"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
	for _, empty := range []string{"", "{}", "null", "not json"} {
		if got := ResultSummary([]byte(empty)); got != "" {
			t.Errorf("%q: got %q, want empty", empty, got)
		}
	}
}
