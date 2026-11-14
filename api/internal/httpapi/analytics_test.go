package httpapi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Analytics counts every family in the test database, so these tests compare
// before and after instead of expecting exact numbers. Families get their
// created_at pinned to the test clock, because the column defaults to the
// database's real now().
func startFamilyAt(t *testing.T, template string, at time.Time) httpapi.Family {
	t.Helper()
	c := testutil.New(t)
	fam := c.StartDemo(template)
	if _, err := c.Pool.Exec(context.Background(), `UPDATE families SET created_at = $1 WHERE id = $2`, at, fam.Id); err != nil {
		t.Fatal(err)
	}
	return fam
}

func metricTotal(t *testing.T, a httpapi.Analytics, m httpapi.AnalyticsMetric) int {
	t.Helper()
	for _, s := range a.Series {
		if s.Metric == m {
			return s.Total
		}
	}
	t.Fatalf("no series for %s", m)
	return 0
}

func templateFamilies(a httpapi.Analytics, tmpl httpapi.DemoTemplate) int {
	for _, tc := range a.Templates {
		if tc.Template == tmpl {
			return tc.Families
		}
	}
	return -1
}

func TestAnalyticsNeedsSessionAndValidDays(t *testing.T) {
	c := testutil.New(t)
	var e httpapi.Error
	c.Get("/api/admin/analytics", http.StatusUnauthorized, &e)
	if e.Code != "no_session" {
		t.Errorf("code = %q", e.Code)
	}
	c.StartDemo("pregnancy")
	c.Get("/api/admin/analytics?days=0", http.StatusBadRequest, nil)
	c.Get("/api/admin/analytics?days=31", http.StatusBadRequest, nil)
}

func TestAnalyticsShape(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")
	var a httpapi.Analytics
	c.Get("/api/admin/analytics", http.StatusOK, &a)
	if got, want := a.To.Format("2006-01-02"), "2026-11-14"; got != want {
		t.Errorf("to = %s, want %s", got, want)
	}
	if got, want := a.From.Format("2006-01-02"), "2026-11-08"; got != want {
		t.Errorf("from = %s, want %s (default 7 days)", got, want)
	}
	if len(a.Series) != 12 || a.Series[0].Metric != httpapi.AnalyticsMetricDemoStarted {
		t.Fatalf("series = %d, first %v; want one per AnalyticsMetric in enum order", len(a.Series), a.Series[0].Metric)
	}
	for _, s := range a.Series {
		if len(s.Days) != 7 || s.Days[0].Date.Format("2006-01-02") != "2026-11-08" || s.Days[6].Date.Format("2006-01-02") != "2026-11-14" {
			t.Errorf("%s: %d days from %v; want 7, oldest first", s.Metric, len(s.Days), s.Days)
		}
		sum := 0
		for _, d := range s.Days {
			sum += d.Count
		}
		if sum != s.Total {
			t.Errorf("%s: total %d, days sum to %d", s.Metric, s.Total, sum)
		}
	}
	if len(a.Templates) != 5 {
		t.Errorf("templates = %d, want every DemoTemplate", len(a.Templates))
	}

	var month httpapi.Analytics
	c.Get("/api/admin/analytics?days=30", http.StatusOK, &month)
	if len(month.Series[0].Days) != 30 {
		t.Errorf("days=30 gave %d days", len(month.Series[0].Days))
	}
}

func TestAnalyticsCountsDemoStartsInTheWindow(t *testing.T) {
	c := testutil.New(t)
	c.StartDemo("pregnancy")
	var before, beforeMonth httpapi.Analytics
	c.Get("/api/admin/analytics", http.StatusOK, &before)
	c.Get("/api/admin/analytics?days=30", http.StatusOK, &beforeMonth)

	startFamilyAt(t, "newborn", testutil.Now)
	startFamilyAt(t, "preschool", testutil.Now.AddDate(0, 0, -10)) // outside 7 days, inside 30

	var after, afterMonth httpapi.Analytics
	c.Get("/api/admin/analytics", http.StatusOK, &after)
	c.Get("/api/admin/analytics?days=30", http.StatusOK, &afterMonth)

	if d := metricTotal(t, after, httpapi.AnalyticsMetricDemoStarted) - metricTotal(t, before, httpapi.AnalyticsMetricDemoStarted); d != 1 {
		t.Errorf("demo_started over 7 days went up by %d, want 1", d)
	}
	if d := after.Series[0].Days[6].Count - before.Series[0].Days[6].Count; d != 1 {
		t.Errorf("demo_started today went up by %d, want 1", d)
	}
	if d := metricTotal(t, afterMonth, httpapi.AnalyticsMetricDemoStarted) - metricTotal(t, beforeMonth, httpapi.AnalyticsMetricDemoStarted); d != 2 {
		t.Errorf("demo_started over 30 days went up by %d, want 2", d)
	}
	if d := templateFamilies(after, httpapi.DemoTemplateNewborn) - templateFamilies(before, httpapi.DemoTemplateNewborn); d != 1 {
		t.Errorf("newborn families went up by %d, want 1", d)
	}
	if d := templateFamilies(after, httpapi.DemoTemplatePreschool) - templateFamilies(before, httpapi.DemoTemplatePreschool); d != 0 {
		t.Errorf("preschool families over 7 days went up by %d, want 0 (started 10 days ago)", d)
	}
	if d := metricTotal(t, after, httpapi.AnalyticsMetricCustomFamilyStarted) - metricTotal(t, before, httpapi.AnalyticsMetricCustomFamilyStarted); d != 0 {
		t.Errorf("custom_family_started went up by %d for template families", d)
	}
}

// The dashboard is the one read across families: it must carry counts only.
func TestAnalyticsReturnsNoIdsOrNames(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	var raw json.RawMessage
	c.Get("/api/admin/analytics?days=30", http.StatusOK, &raw)
	if regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`).Match(raw) {
		t.Errorf("analytics response contains an id: %s", raw)
	}
	for _, p := range fam.Parents {
		if regexp.MustCompile(regexp.QuoteMeta(p.DisplayName)).Match(raw) {
			t.Errorf("analytics response contains the name %q", p.DisplayName)
		}
	}
}
