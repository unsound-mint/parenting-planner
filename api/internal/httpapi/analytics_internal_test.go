package httpapi

import (
	"os"
	"regexp"
	"testing"
)

// The handler lists metrics and templates in contract order; this keeps the
// Go lists in step with openapi.yaml.
func TestAnalyticsEnumsMatchContract(t *testing.T) {
	spec, err := GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	check := func(schema string, got []string) {
		t.Helper()
		enum := spec.Components.Schemas[schema].Value.Enum
		if len(enum) != len(got) {
			t.Fatalf("%s: contract has %d values, handler lists %d", schema, len(enum), len(got))
		}
		for i, v := range enum {
			if v != got[i] {
				t.Errorf("%s[%d]: contract %v, handler %s", schema, i, v, got[i])
			}
		}
	}
	var metrics, templates []string
	for _, m := range analyticsMetrics {
		metrics = append(metrics, string(m))
	}
	for _, d := range demoTemplates {
		templates = append(templates, string(d))
	}
	check("AnalyticsMetric", metrics)
	check("DemoTemplate", templates)
}

// Analytics reads across families, so its queries may only name tables on
// this allow-list. Health tables (mood, diary, labs, vaccines, allergies,
// growth, screenings, psychologist bookings, session notes, insurance calls,
// care log contents) must never be added here.
func TestAnalyticsReadsOnlyAllowListedTables(t *testing.T) {
	allowed := map[string]bool{"families": true}
	b, err := os.ReadFile("../store/queries/analytics.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := regexp.MustCompile(`--.*`).ReplaceAllString(string(b), "")
	for _, m := range regexp.MustCompile(`(?i)\b(?:FROM|JOIN)\s+([a-z_]+)`).FindAllStringSubmatch(sql, -1) {
		if m[1] == "generate_series" {
			continue
		}
		if !allowed[m[1]] {
			t.Errorf("analytics.sql reads %s, which is not on the analytics allow-list", m[1])
		}
	}
}
