package httpapi_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/ai"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestServerRunsWithoutAIKey(t *testing.T) {
	c := testutil.NewWithConfig(t, httpapi.Config{AI: ai.Config{}})
	c.Get("/api/healthz", http.StatusOK, nil)
	fam := c.StartDemo("pregnancy")
	mother := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Get("/api/members/"+mother.Id.String()+"/plan", http.StatusOK, nil)
}

func TestAIKeyNeverInResponses(t *testing.T) {
	const fakeKey = "test-key-not-real"
	c := testutil.NewWithConfig(t, httpapi.Config{AI: ai.Config{APIKey: ai.Secret(fakeKey), Model: "test-model"}})
	var bodies []string
	get := func(path string, status int) {
		var raw json.RawMessage
		c.Get(path, status, &raw)
		bodies = append(bodies, string(raw))
	}
	get("/api/healthz", http.StatusOK)
	get("/api/family", http.StatusUnauthorized)

	var created json.RawMessage
	c.Post("/api/demo/sessions", map[string]string{"template": "pregnancy"}, http.StatusCreated, &created)
	bodies = append(bodies, string(created))
	var fam httpapi.Family
	if err := json.Unmarshal(created, &fam); err != nil {
		t.Fatal(err)
	}
	get("/api/family", http.StatusOK)
	for _, p := range fam.Parents {
		get("/api/members/"+p.Id.String()+"/plan", http.StatusOK)
		var raw json.RawMessage
		c.Post("/api/members/"+p.Id.String()+"/mood-checkins",
			map[string]any{"mood": 3, "energy": 3, "sleepHours": 7, "visibility": "private"}, http.StatusCreated, &raw)
		bodies = append(bodies, string(raw))
		get("/api/members/"+p.Id.String()+"/mood-checkins", http.StatusOK)
	}
	for _, b := range bodies {
		if strings.Contains(b, fakeKey) || strings.Contains(b, "test-model") {
			t.Fatalf("AI config leaked into a response: %s", b)
		}
	}
}
