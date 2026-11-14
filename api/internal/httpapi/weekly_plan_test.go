package httpapi_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/ai"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func weeklyPath(id uuid.UUID) string { return "/api/members/" + id.String() + "/weekly-plan" }

// fakeClaude answers like the Anthropic messages API and records what it was sent.
type fakeClaude struct {
	mu       sync.Mutex
	requests []string
	headers  []http.Header
	status   int
	text     string
	delay    time.Duration
}

func (f *fakeClaude) server(t *testing.T) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		f.mu.Lock()
		f.requests = append(f.requests, string(b))
		f.headers = append(f.headers, r.Header.Clone())
		f.mu.Unlock()
		time.Sleep(f.delay)
		if f.status != 0 && f.status != 200 {
			w.WriteHeader(f.status)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"content": []map[string]any{{"type": "text", "text": f.text}}})
	}))
	t.Cleanup(srv.Close)
	return srv
}

const claudeGood = `{"intro":"A steady week ahead.","sections":[{"title":"For you","points":[{"text":"Book your glucose screening this week.","reason":"It is due around week 25.","ruleId":"glucose-screen"}]}]}`

func withClaude(t *testing.T, f *fakeClaude) *testutil.Client {
	srv := f.server(t)
	return testutil.NewWithConfig(t, httpapi.Config{AI: ai.Config{APIKey: ai.Secret("test-key"), Model: "test-model", BaseURL: srv.URL, Timeout: 500 * time.Millisecond}})
}

func TestWeeklyPlanFallsBackToTheRulePlanWithoutAKey(t *testing.T) {
	c := testutil.NewWithConfig(t, httpapi.Config{})
	testutil.New(t).Get(weeklyPath(uuid.New()), http.StatusUnauthorized, nil)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var m, j httpapi.WeeklyPlan
	c.Get(weeklyPath(mom.Id), http.StatusOK, &m)
	c.Get(weeklyPath(jake.Id), http.StatusOK, &j)
	if !m.Fallback || m.Intro == "" || len(m.Sections) != 1 {
		t.Fatalf("mom = %+v", m)
	}
	pt := m.Sections[0].Points[0]
	if pt.RuleId == nil || *pt.RuleId != "glucose-screen" || pt.Source == nil || pt.Source.Url == "" || pt.Reason == "" {
		t.Errorf("fallback points come from the rule plan, with sources: %+v", pt)
	}
	if !j.Fallback || (len(j.Sections) > 0 && len(j.Sections[0].Points) > 0 && j.Sections[0].Points[0].RuleId != nil && *j.Sections[0].Points[0].RuleId == "glucose-screen") {
		t.Errorf("the other parent gets a different plan: %+v", j)
	}
	for _, cg := range fam.Caregivers {
		c.Get(weeklyPath(cg.Id), http.StatusNotFound, nil)
	}
	if n := c.AuditCount(fam.Id, "read", "weekly_plan"); n != 2 {
		t.Errorf("weekly plan audit rows = %d, want 2", n)
	}
}

func TestWeeklyPlanUsesTheModelWhenItAnswersWell(t *testing.T) {
	f := &fakeClaude{text: claudeGood}
	c := withClaude(t, f)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var p httpapi.WeeklyPlan
	c.Get(weeklyPath(mom.Id), http.StatusOK, &p)
	if p.Fallback || p.Intro != "A steady week ahead." || len(p.Sections) != 1 {
		t.Fatalf("plan = %+v", p)
	}
	if pt := p.Sections[0].Points[0]; pt.RuleId == nil || pt.Source == nil || pt.Source.Url == "" {
		t.Errorf("the source comes from the rule, not the model: %+v", pt)
	}
	if len(f.requests) != 1 || f.headers[0].Get("x-api-key") != "test-key" || f.headers[0].Get("anthropic-version") == "" {
		t.Fatalf("request = %v %v", f.requests, f.headers)
	}
	var req struct {
		Model    string                     `json:"model"`
		System   string                     `json:"system"`
		Messages []struct{ Content string } `json:"messages"`
	}
	if err := json.Unmarshal([]byte(f.requests[0]), &req); err != nil || req.Model != "test-model" || !strings.Contains(req.System, "Never diagnose") {
		t.Errorf("request = %+v %v", req, err)
	}
	if !strings.Contains(req.Messages[0].Content, "glucose-screen") || strings.Contains(f.requests[0], "test-key") {
		t.Error("the prompt holds the plan items and never the key")
	}
}

func TestWeeklyPlanPromptHoldsOnlyThisParentsNumbers(t *testing.T) {
	f := &fakeClaude{text: claudeGood}
	c := withClaude(t, f)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	// Mom's private check-in with a note; Jake's own check-in.
	c.Post("/api/members/"+mom.Id.String()+"/mood-checkins", map[string]any{"mood": 1, "energy": 1, "sleepHours": 3.5, "visibility": "private", "note": "SECRET-NOTE-TEXT"}, http.StatusCreated, nil)
	c.Post("/api/members/"+jake.Id.String()+"/mood-checkins", map[string]any{"mood": 4, "energy": 4, "sleepHours": 8, "visibility": "private"}, http.StatusCreated, nil)

	c.Get(weeklyPath(jake.Id), http.StatusOK, nil)
	jakePrompt := f.requests[len(f.requests)-1]
	if strings.Contains(jakePrompt, "3.5") || strings.Contains(jakePrompt, "SECRET") || !strings.Contains(jakePrompt, "8") {
		t.Errorf("Jake's prompt must hold his numbers and none of Mom's: %s", jakePrompt)
	}
	c.Get(weeklyPath(mom.Id), http.StatusOK, nil)
	momPrompt := f.requests[len(f.requests)-1]
	if strings.Contains(momPrompt, "SECRET") || strings.Contains(momPrompt, "note") && strings.Contains(momPrompt, "SECRET") {
		t.Errorf("notes are free text and never sent: %s", momPrompt)
	}
	if !strings.Contains(momPrompt, "3.5") {
		t.Errorf("Mom's own numbers go in: %s", momPrompt)
	}
}

func TestWeeklyPlanFallsBackWhenTheModelFailsOrBreaksARule(t *testing.T) {
	cases := map[string]*fakeClaude{
		"an error":        {status: 500},
		"not json":        {text: "Sure! Here is a plan."},
		"a diagnosis":     {text: `{"intro":"x","sections":[{"title":"t","points":[{"text":"You have depression.","reason":"b"}]}]}`},
		"an unknown rule": {text: `{"intro":"x","sections":[{"title":"t","points":[{"text":"a","reason":"b","ruleId":"made-up"}]}]}`},
		"a slow answer":   {text: claudeGood, delay: 2 * time.Second},
	}
	for name, f := range cases {
		c := withClaude(t, f)
		fam := c.StartDemo("pregnancy")
		var p httpapi.WeeklyPlan
		c.Get(weeklyPath(testutil.Parent(t, fam, httpapi.ParentRoleMother).Id), http.StatusOK, &p)
		if !p.Fallback || len(p.Sections) != 1 || p.Sections[0].Points[0].Source == nil {
			t.Errorf("%s: want the rule plan as fallback, got %+v", name, p)
		}
	}
}
