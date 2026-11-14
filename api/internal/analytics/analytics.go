// Package analytics counts usage across all demo families for the operator
// dashboard. It is the one deliberate read across families in the API, so it
// follows three rules instead of the family filter:
//
//   - Counts only: no ids, names, dates of birth or free text leave this package.
//   - Sources are an allow-list of non-health tables. Mood check-ins, diary,
//     labs, vaccines, allergies, growth, screenings, psychologist bookings,
//     session notes, insurance calls and care log contents are never read.
//   - Metrics whose source table does not exist yet return zeros, so the
//     dashboard shape never changes when a feature lands.
package analytics

import (
	"context"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Metric names, matching AnalyticsMetric in openapi.yaml.
const (
	DemoStarted         = "demo_started"
	CustomFamilyStarted = "custom_family_started"
)

// Report holds the counts for a window of whole UTC days.
type Report struct {
	From, To time.Time
	// Days lists every day in the window, oldest first.
	Days []time.Time
	// Daily maps a metric to one count per entry in Days. A metric that is not
	// counted yet is missing; callers treat it as all zeros.
	Daily map[string][]int
	// Templates maps a demo template to the families started with it in the window.
	Templates map[string]int
}

// Load counts the window of `days` UTC days ending on `today`.
func Load(ctx context.Context, q *store.Queries, today time.Time, days int) (Report, error) {
	from := today.AddDate(0, 0, -(days - 1))
	r := Report{From: from, To: today, Daily: map[string][]int{}, Templates: map[string]int{}}

	// demo_started counts every family started, custom ones included;
	// custom_family_started is the custom subset.
	rows, err := q.CountFamiliesStartedByDay(ctx, store.CountFamiliesStartedByDayParams{FromDay: from, ToDay: today})
	if err != nil {
		return r, err
	}
	for _, row := range rows {
		r.Days = append(r.Days, row.Day)
		r.Daily[DemoStarted] = append(r.Daily[DemoStarted], int(row.Started))
		r.Daily[CustomFamilyStarted] = append(r.Daily[CustomFamilyStarted], int(row.CustomStarted))
	}

	byTemplate, err := q.CountFamiliesStartedByTemplate(ctx, store.CountFamiliesStartedByTemplateParams{FromDay: from, ToDay: today})
	if err != nil {
		return r, err
	}
	for _, row := range byTemplate {
		r.Templates[row.Template] = int(row.Families)
	}
	return r, nil
}
