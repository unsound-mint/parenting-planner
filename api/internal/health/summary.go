package health

import (
	"encoding/json"
	"fmt"
	"strings"
)

// panelFields are the values a stored result can carry, in the order they are
// shown. Text values print as "Label: value", numbers as "Label 13.1 unit".
var panelFields = []struct{ key, label, unit string }{
	{"rubella", "Rubella", ""},
	{"varicella", "Varicella", ""},
	{"hemoglobin_g_dl", "Hemoglobin", "g/dL"},
	{"tsh_miu_l", "TSH", "mIU/L"},
	{"blood_type", "Blood type", ""},
}

// ResultSummary puts the values of a stored screening result in words, for
// the passport card. It returns "" when the record has no values, and never
// interprets them: the line only repeats what was stored.
func ResultSummary(result []byte) string {
	var vals map[string]any
	if len(result) == 0 || json.Unmarshal(result, &vals) != nil {
		return ""
	}
	var parts []string
	for _, f := range panelFields {
		switch v := vals[f.key].(type) {
		case string:
			if v != "" {
				parts = append(parts, f.label+": "+v)
			}
		case float64:
			parts = append(parts, strings.TrimSpace(fmt.Sprintf("%s %g %s", f.label, v, f.unit)))
		}
	}
	return strings.Join(parts, " · ")
}
