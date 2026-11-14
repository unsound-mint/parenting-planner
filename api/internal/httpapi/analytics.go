package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/analytics"
)

// analyticsMetrics and demoTemplates are the AnalyticsMetric and DemoTemplate
// enums in openapi.yaml order; TestAnalyticsEnumsMatchContract keeps them in step.
var (
	analyticsMetrics = []AnalyticsMetric{
		AnalyticsMetricDemoStarted, AnalyticsMetricCustomFamilyStarted,
		AnalyticsMetricTaskCreated, AnalyticsMetricTaskDone,
		AnalyticsMetricHandoffCreated, AnalyticsMetricCareLogEntryCreated,
		AnalyticsMetricSimulatorRoundPlayed, AnalyticsMetricBookingRequested,
		AnalyticsMetricInvitationAccepted, AnalyticsMetricCheckoutStarted,
		AnalyticsMetricCheckoutPaid, AnalyticsMetricPartnerOfferClicked,
	}
	demoTemplates = []DemoTemplate{
		DemoTemplatePlanning, DemoTemplatePregnancy, DemoTemplateNewborn,
		DemoTemplatePreschool, DemoTemplateCustom,
	}
)

// GetAnalytics is the one handler that reads across families. It needs a
// session (any demo family may open the dashboard) but does not filter by it;
// internal/analytics returns counts only, from non-health tables.
func (s *Server) GetAnalytics(ctx context.Context, req GetAnalyticsRequestObject) (GetAnalyticsResponseObject, error) {
	if _, ok := familyFrom(ctx); !ok {
		return GetAnalytics401JSONResponse(errNoSession), nil
	}
	days := 7
	if req.Params.Days != nil {
		days = *req.Params.Days
	}
	r, err := analytics.Load(ctx, s.q, s.today(), days)
	if err != nil {
		return nil, err
	}
	out := Analytics{
		From:        openapi_types.Date{Time: r.From},
		To:          openapi_types.Date{Time: r.To},
		GeneratedAt: s.cfg.Now().UTC(),
		Series:      make([]AnalyticsSeries, 0, len(analyticsMetrics)),
		Templates:   make([]TemplateCount, 0, len(demoTemplates)),
	}
	for _, m := range analyticsMetrics {
		counts := r.Daily[string(m)]
		series := AnalyticsSeries{Metric: m, Days: make([]AnalyticsDay, len(r.Days))}
		for i, d := range r.Days {
			n := 0
			if i < len(counts) {
				n = counts[i]
			}
			series.Days[i] = AnalyticsDay{Date: openapi_types.Date{Time: d}, Count: n}
			series.Total += n
		}
		out.Series = append(out.Series, series)
	}
	for _, t := range demoTemplates {
		out.Templates = append(out.Templates, TemplateCount{Template: t, Families: r.Templates[string(t)]})
	}
	return GetAnalytics200JSONResponse(out), nil
}
