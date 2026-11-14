package httpapi_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func fertPath(m httpapi.Parent, tail string) string {
	return "/api/members/" + m.Id.String() + tail
}

func fertDay(offset int) string {
	return time.Now().UTC().AddDate(0, 0, offset).Format("2006-01-02")
}

func planningParents(t *testing.T, c *testutil.Client) (httpapi.Family, httpapi.Parent, httpapi.Parent) {
	fam := c.StartDemo("planning")
	return fam, testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
}

func TestFertilityEntryValidation(t *testing.T) {
	c := testutil.New(t)
	_, maya, _ := planningParents(t, c)
	p := fertPath(maya, "/fertility-entries")
	e := func(kind, date string, extra map[string]any) map[string]any {
		m := map[string]any{"kind": kind, "date": date, "visibility": "private"}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}
	today := fertDay(0)
	c.Post(p, e("period", today, nil), http.StatusBadRequest, nil)                                                     // no flow
	c.Post(p, e("period", today, map[string]any{"code": "gushing"}), http.StatusBadRequest, nil)                       // unknown flow
	c.Post(p, e("symptom", today, map[string]any{"code": "x"}), http.StatusBadRequest, nil)                            // unknown symptom
	c.Post(p, e("ovulation_test", today, map[string]any{"code": "maybe"}), http.StatusBadRequest, nil)                 // unknown result
	c.Post(p, e("bbt", today, nil), http.StatusBadRequest, nil)                                                        // no temperature
	c.Post(p, e("bbt", today, map[string]any{"tempC": 50}), http.StatusBadRequest, nil)                                // schema range
	c.Post(p, e("test", today, nil), http.StatusBadRequest, nil)                                                       // no note
	c.Post(p, e("treatment_note", today, map[string]any{"note": "  "}), http.StatusBadRequest, nil)                    // blank note
	c.Post(p, e("period", fertDay(3), map[string]any{"code": "light"}), http.StatusBadRequest, nil)                    // future
	c.Post(p, e("nonsense", today, nil), http.StatusBadRequest, nil)                                                   // kind enum
	c.Post(p, e("period", today, map[string]any{"code": "light", "visibility": "family"}), http.StatusBadRequest, nil) // no family level
	c.Post(p, e("period", today, map[string]any{"code": "light", "visibility": "care_team"}), http.StatusBadRequest, nil)
	c.Post(p, e("test", fertDay(5), map[string]any{"note": "Planned blood test"}), http.StatusCreated, nil) // a planned test is fine
}

func TestFertilityPrivacyBetweenParentsAndFromCaregivers(t *testing.T) {
	c := testutil.New(t)
	fam, maya, daniel := planningParents(t, c)
	p := fertPath(maya, "/fertility-entries")

	var secret, shared httpapi.FertilityEntry
	c.Post(p, map[string]any{"kind": "treatment_note", "date": fertDay(0), "note": "SECRET-NOTE", "visibility": "private"}, http.StatusCreated, &secret)
	c.Post(p, map[string]any{"kind": "treatment_note", "date": fertDay(0), "note": "SHARED-NOTE", "visibility": "partner"}, http.StatusCreated, &shared)

	var own, theirs httpapi.FertilityEntryList
	c.Get(p, http.StatusOK, &own)
	c.Get(fertPath(daniel, "/fertility-entries"), http.StatusOK, &theirs)
	seen := func(l httpapi.FertilityEntryList, note string) bool {
		for _, it := range l.Items {
			if it.Note != nil && *it.Note == note {
				return true
			}
		}
		return false
	}
	if !seen(own, "SECRET-NOTE") || !seen(own, "SHARED-NOTE") {
		t.Error("the author must see both notes")
	}
	if seen(theirs, "SECRET-NOTE") || !seen(theirs, "SHARED-NOTE") {
		t.Error("the partner must see only the shared note")
	}
	for _, it := range theirs.Items {
		if it.Visibility != httpapi.FertilityVisibilityPartner {
			t.Errorf("partner sees an entry with visibility %s", it.Visibility)
		}
	}

	// The partner cannot change, share, delete or even find the author's entries.
	dp := fertPath(daniel, "/fertility-entries/")
	c.Patch(dp+secret.Id.String(), map[string]any{"visibility": "partner"}, http.StatusNotFound, nil)
	c.Patch(dp+shared.Id.String(), map[string]any{"visibility": "private"}, http.StatusNotFound, nil)
	c.Delete(dp+shared.Id.String(), http.StatusNotFound, nil)

	// The author can take a share back.
	var back httpapi.FertilityEntry
	c.Patch(p+"/"+shared.Id.String(), map[string]any{"visibility": "private"}, http.StatusOK, &back)
	var after httpapi.FertilityEntryList
	c.Get(fertPath(daniel, "/fertility-entries"), http.StatusOK, &after)
	if seen(after, "SHARED-NOTE") {
		t.Error("an unshared entry must disappear for the partner")
	}
	c.Patch(p+"/"+shared.Id.String(), map[string]any{"visibility": "family"}, http.StatusBadRequest, nil)

	// A caregiver never sees any of it.
	if len(fam.Caregivers) == 0 {
		t.Fatal("the planning family has caregivers")
	}
	for _, cg := range fam.Caregivers {
		b := "/api/members/" + cg.Id.String()
		c.Get(b+"/fertility-entries", http.StatusNotFound, nil)
		c.Post(b+"/fertility-entries", map[string]any{"kind": "bbt", "date": fertDay(0), "tempC": 36.5, "visibility": "private"}, http.StatusNotFound, nil)
		c.Get(b+"/fertility-overview", http.StatusNotFound, nil)
		c.Get(b+"/preconception-checklist", http.StatusNotFound, nil)
		c.Put(b+"/preconception-checklist/folic_acid", map[string]any{"done": true}, http.StatusNotFound, nil)
		c.Get(b+"/journey-settings", http.StatusNotFound, nil)
		c.Put(b+"/journey-settings", map[string]any{"hideBabyContent": true, "fertilityTreatment": false, "previousLoss": false}, http.StatusNotFound, nil)
	}

	// Another family never sees it.
	c.StartDemo("planning")
	c.Get(p, http.StatusNotFound, nil)
}

func TestFertilityDayEntriesAreReplaced(t *testing.T) {
	c := testutil.New(t)
	_, maya, _ := planningParents(t, c)
	p := fertPath(maya, "/fertility-entries")
	d := fertDay(-100) // outside the seeded cycles
	c.Post(p, map[string]any{"kind": "bbt", "date": d, "tempC": 36.4, "visibility": "private"}, http.StatusCreated, nil)
	c.Post(p, map[string]any{"kind": "bbt", "date": d, "tempC": 36.7, "visibility": "private"}, http.StatusCreated, nil)
	c.Post(p, map[string]any{"kind": "symptom", "date": d, "code": "cramps", "visibility": "private"}, http.StatusCreated, nil)
	c.Post(p, map[string]any{"kind": "symptom", "date": d, "code": "headache", "visibility": "private"}, http.StatusCreated, nil)
	c.Post(p, map[string]any{"kind": "symptom", "date": d, "code": "cramps", "visibility": "private"}, http.StatusCreated, nil)
	var l httpapi.FertilityEntryList
	c.Get(p, http.StatusOK, &l)
	bbt, symptoms := 0, 0
	for _, it := range l.Items {
		if it.Date.Format("2006-01-02") != d {
			continue
		}
		switch it.Kind {
		case httpapi.Bbt:
			bbt++
			if it.TempC == nil || *it.TempC != 36.7 {
				t.Errorf("temperature = %v, want the last one, 36.7", it.TempC)
			}
		case httpapi.Symptom:
			symptoms++
		}
	}
	if bbt != 1 || symptoms != 2 {
		t.Errorf("day has %d temperatures and %d symptoms, want 1 and 2", bbt, symptoms)
	}
}

func TestFertilityOverviewIsAnEstimate(t *testing.T) {
	c := testutil.New(t)
	_, maya, daniel := planningParents(t, c)
	var ov httpapi.FertilityOverview
	c.Get(fertPath(maya, "/fertility-overview"), http.StatusOK, &ov)
	if ov.Estimate == nil || ov.CycleDay == nil || *ov.CycleDay != 10 {
		t.Fatalf("the seeded family is on cycle day 10 with an estimate: %+v", ov)
	}
	e := ov.Estimate
	if e.AverageCycleDays != 29 || e.SpreadDays != 2 || e.CyclesUsed != 4 {
		t.Errorf("estimate %+v", e)
	}
	if !e.WindowStart.Before(e.Ovulation.Time) || !e.Ovulation.Before(e.WindowEnd.Time) || !e.Ovulation.Before(e.NextPeriod.Time) {
		t.Errorf("window must surround ovulation and end before the next period: %+v", e)
	}
	if got := e.NextPeriod.Sub(e.Ovulation.Time).Hours() / 24; got != 14 {
		t.Errorf("ovulation is %v days before the next period, ACOG says about 14", got)
	}
	if ov.Clinician.Suggest || ov.Clinician.MonthsTrying == nil || *ov.Clinician.MonthsTrying != 5 || ov.Clinician.ThresholdMonths != 12 {
		t.Errorf("clinician hint for 5 months, age 31: %+v", ov.Clinician)
	}
	if len(ov.Sources) == 0 {
		t.Error("the overview must carry sources")
	}

	// Daniel has no period days, so there is nothing to estimate for him, and Maya's shared
	// period days (this cycle) never feed his overview.
	var dov httpapi.FertilityOverview
	c.Get(fertPath(daniel, "/fertility-overview"), http.StatusOK, &dov)
	if dov.Estimate != nil || len(dov.Cycles) != 0 || dov.CyclesNeeded == nil || *dov.CyclesNeeded != 2 {
		t.Errorf("partner overview must not use shared entries: %+v", dov)
	}

	// Trying for 13 months asks for a clinician; it never diagnoses.
	since := time.Now().UTC().AddDate(0, -13, 0).Format("2006-01-02")
	c.Put(fertPath(maya, "/journey-settings"), map[string]any{"hideBabyContent": false, "fertilityTreatment": false, "previousLoss": false, "tryingSince": since}, http.StatusOK, nil)
	c.Get(fertPath(maya, "/fertility-overview"), http.StatusOK, &ov)
	if !ov.Clinician.Suggest {
		t.Errorf("13 months of trying must reach the 12 month threshold: %+v", ov.Clinician)
	}
}

func TestPreconceptionChecklist(t *testing.T) {
	c := testutil.New(t)
	_, maya, daniel := planningParents(t, c)
	var l httpapi.PreconceptionChecklist
	c.Get(fertPath(maya, "/preconception-checklist"), http.StatusOK, &l)
	if l.Total != 8 || l.Done != 4 || l.PartnerShared != 2 {
		t.Fatalf("Maya: total %d done %d partnerShared %d, want 8, 4, 2", l.Total, l.Done, l.PartnerShared)
	}
	for _, it := range l.Items {
		if it.Source.Url == "" || it.Source.CheckedAt.IsZero() {
			t.Errorf("%s has no source", it.Key)
		}
		if it.Key == "partner_visit" {
			t.Error("an item for the partner is on the mother's list")
		}
		// Daniel shared smoking and alcohol; his private question_list tick is hidden.
		if it.PartnerDone != (it.Key == "smoking" || it.Key == "alcohol") {
			t.Errorf("partnerDone for %s = %v", it.Key, it.PartnerDone)
		}
	}
	var dl httpapi.PreconceptionChecklist
	c.Get(fertPath(daniel, "/preconception-checklist"), http.StatusOK, &dl)
	if dl.Total != 7 || dl.Done != 3 || dl.PartnerShared != 2 {
		t.Errorf("Daniel: total %d done %d partnerShared %d, want 7, 3, 2 (Maya shared two)", dl.Total, dl.Done, dl.PartnerShared)
	}
	// Maya's shared folic acid is shown to Daniel although it is not on his list.
	onlyHers := 0
	for _, it := range dl.Items {
		if it.PartnerOnly != nil && *it.PartnerOnly {
			onlyHers++
			if it.Done {
				t.Errorf("Daniel cannot have ticked %s", it.Key)
			}
		}
	}
	if onlyHers != 2 {
		t.Errorf("Daniel sees %d of Maya's own items, want 2 (folic acid, planning visit)", onlyHers)
	}

	// Tick, share, untick.
	var after httpapi.PreconceptionChecklist
	c.Put(fertPath(maya, "/preconception-checklist/mmr_check"), map[string]any{"done": true, "visibility": "partner"}, http.StatusOK, &after)
	if after.Done != 5 {
		t.Errorf("done = %d, want 5", after.Done)
	}
	c.Get(fertPath(daniel, "/preconception-checklist"), http.StatusOK, &dl)
	if dl.PartnerShared != 3 {
		t.Errorf("Daniel sees %d shared ticks, want 3", dl.PartnerShared)
	}
	c.Put(fertPath(maya, "/preconception-checklist/mmr_check"), map[string]any{"done": false}, http.StatusOK, &after)
	if after.Done != 4 {
		t.Errorf("done = %d, want 4", after.Done)
	}
	c.Put(fertPath(maya, "/preconception-checklist/nope"), map[string]any{"done": true}, http.StatusNotFound, nil)
	c.Put(fertPath(maya, "/preconception-checklist/partner_visit"), map[string]any{"done": true}, http.StatusNotFound, nil)
	c.Put(fertPath(maya, "/preconception-checklist/mmr_check"), map[string]any{"done": true, "visibility": "family"}, http.StatusBadRequest, nil)
}

func TestJourneySettings(t *testing.T) {
	c := testutil.New(t)
	_, maya, daniel := planningParents(t, c)
	var s httpapi.JourneySettings
	c.Get(fertPath(daniel, "/journey-settings"), http.StatusOK, &s)
	if s.HideBabyContent || s.FertilityTreatment || s.PreviousLoss || s.TryingSince != nil {
		t.Errorf("defaults are all off: %+v", s)
	}
	c.Put(fertPath(daniel, "/journey-settings"), map[string]any{"hideBabyContent": true, "fertilityTreatment": true, "previousLoss": true}, http.StatusOK, &s)
	if !s.HideBabyContent || !s.FertilityTreatment || !s.PreviousLoss {
		t.Errorf("saved: %+v", s)
	}
	// Per person: Maya's flag is untouched.
	c.Get(fertPath(maya, "/journey-settings"), http.StatusOK, &s)
	if s.HideBabyContent || s.TryingSince == nil {
		t.Errorf("Maya's own settings changed: %+v", s)
	}
	c.Put(fertPath(maya, "/journey-settings"), map[string]any{"hideBabyContent": false, "fertilityTreatment": false, "previousLoss": false, "tryingSince": fertDay(4)}, http.StatusBadRequest, nil)
	c.Put(fertPath(maya, "/journey-settings"), map[string]any{"fertilityTreatment": false}, http.StatusBadRequest, nil)
}

func TestFertilityIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam, maya, _ := planningParents(t, c)
	p := fertPath(maya, "/fertility-entries")
	var e httpapi.FertilityEntry
	c.Post(p, map[string]any{"kind": "bbt", "date": fertDay(-100), "tempC": 36.5, "visibility": "private"}, http.StatusCreated, &e)
	c.Get(p, http.StatusOK, nil)
	c.Patch(p+"/"+e.Id.String(), map[string]any{"visibility": "partner"}, http.StatusOK, nil)
	c.Get(fertPath(maya, "/fertility-overview"), http.StatusOK, nil)
	c.Get(fertPath(maya, "/preconception-checklist"), http.StatusOK, nil)
	c.Put(fertPath(maya, "/preconception-checklist/mmr_check"), map[string]any{"done": true}, http.StatusOK, nil)
	c.Put(fertPath(maya, "/journey-settings"), map[string]any{"hideBabyContent": true, "fertilityTreatment": false, "previousLoss": false}, http.StatusOK, nil)
	c.Delete(p+"/"+e.Id.String(), http.StatusNoContent, nil)
	for _, w := range []struct {
		action, entity string
		n              int
	}{
		{"create", "fertility_entry", 1}, {"read", "fertility_entry", 1}, {"update", "fertility_entry", 1}, {"delete", "fertility_entry", 1},
		{"read", "fertility_overview", 1}, {"read", "preconception_tick", 1}, {"create", "preconception_tick", 1},
		{"update", "journey_settings", 1},
	} {
		if n := c.AuditCount(fam.Id, w.action, w.entity); n != w.n {
			t.Errorf("%s %s audit rows = %d, want %d", w.action, w.entity, n, w.n)
		}
	}
}

// Fertility data must not reach any surface that is not the fertility endpoints: the
// export, the plan, notifications, the calendar a caregiver sees and the calendar feed.
func TestFertilityDoesNotLeakElsewhere(t *testing.T) {
	c := testutil.New(t)
	fam, maya, daniel := planningParents(t, c)
	marker := "ZZ-FERTILITY-MARKER"
	c.Post(fertPath(maya, "/fertility-entries"), map[string]any{"kind": "treatment_note", "date": fertDay(0), "note": marker, "visibility": "partner"}, http.StatusCreated, nil)

	for _, m := range []httpapi.Parent{maya, daniel} {
		for _, tail := range []string{"/export", "/plan", "/notifications", "/mood-checkins", "/diary-entries", "/calendar-events"} {
			status, body := c.Raw("GET", fertPath(m, tail), "", nil)
			if status == http.StatusOK && (strings.Contains(string(body), marker) || strings.Contains(string(body), "fertility") || strings.Contains(string(body), "ovulation_test")) {
				t.Errorf("%s %s mentions fertility data", m.DisplayName, tail)
			}
		}
	}
	for _, cg := range fam.Caregivers {
		for _, tail := range []string{"/calendar-events", "/plan"} {
			_, body := c.Raw("GET", "/api/members/"+cg.Id.String()+tail, "", nil)
			if strings.Contains(string(body), marker) || strings.Contains(string(body), "Preconception visit") {
				t.Errorf("caregiver %s sees fertility data in %s", cg.DisplayName, tail)
			}
		}
	}
}
