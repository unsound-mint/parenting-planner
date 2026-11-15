package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Seeded appointments must read as daytime on the family's clock (the web formats in
// America/New_York). A UTC-hour seed once showed a 10:00 visit as 5 AM. Planning, newborn
// and preschool also need something on this week's calendar.
func TestDemoAppointmentsAreDaytimeOnTheFamilyClock(t *testing.T) {
	zone, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	c := testutil.New(t)
	for _, tpl := range []httpapi.DemoTemplate{
		httpapi.DemoTemplatePlanning, httpapi.DemoTemplatePregnancy, httpapi.DemoTemplateNewborn, httpapi.DemoTemplatePreschool,
	} {
		fam := c.StartDemo(string(tpl))
		mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
		from, to := testutil.Now.AddDate(0, 0, -20), testutil.Now.AddDate(0, 0, 10)
		var l httpapi.CalendarEventList
		c.Get(calBase(mom)+"?scope=family&from="+from.Format("2006-01-02")+"&to="+to.Format("2006-01-02"), http.StatusOK, &l)
		thisWeek := 0
		for _, e := range l.Items {
			if e.Kind != httpapi.CalendarEventKindAppointment && e.Kind != httpapi.CalendarEventKindOther {
				continue
			}
			if h := e.StartsAt.In(zone).Hour(); h < 8 || h > 19 {
				t.Errorf("%s: %q starts at %s on the family clock", tpl, e.Title, e.StartsAt.In(zone).Format("15:04"))
			}
			if !e.StartsAt.Before(testutil.Now) && e.StartsAt.Before(testutil.Now.AddDate(0, 0, 6)) {
				thisWeek++
			}
		}
		if tpl != httpapi.DemoTemplatePregnancy && thisWeek == 0 {
			t.Errorf("%s: nothing on this week's calendar", tpl)
		}
	}
}
