package httpapi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// End-to-end through HTTP and a real Postgres. Runs when TEST_DATABASE_URL is
// set (CI and `make test`); skipped otherwise.
func TestDemoFamilyPlans(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := store.Open(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	now := time.Date(2026, 11, 14, 15, 0, 0, 0, time.UTC)
	srv := httptest.NewServer(httpapi.New(pool, httpapi.Config{Now: func() time.Time { return now }}))
	defer srv.Close()
	jar, _ := cookiejar.New(nil)
	c := &http.Client{Jar: jar}

	get := func(path string, want int, out any) {
		t.Helper()
		res, err := c.Get(srv.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != want {
			t.Fatalf("GET %s: status %d, want %d", path, res.StatusCode, want)
		}
		if out != nil {
			if err := json.NewDecoder(res.Body).Decode(out); err != nil {
				t.Fatal(err)
			}
		}
	}

	get("/api/family", http.StatusUnauthorized, nil)

	res, err := c.Post(srv.URL+"/api/demo/sessions", "application/json", strings.NewReader(`{"template":"pregnancy"}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create session: status %d", res.StatusCode)
	}

	var fam httpapi.Family
	get("/api/family", http.StatusOK, &fam)
	if fam.GestationalWeek == nil || *fam.GestationalWeek != 25 || len(fam.Parents) != 2 {
		t.Fatalf("unexpected family: %+v", fam)
	}

	plans := map[httpapi.ParentRole][]string{}
	for _, p := range fam.Parents {
		var pl httpapi.Plan
		get("/api/members/"+p.Id.String()+"/plan", http.StatusOK, &pl)
		for _, it := range pl.Items {
			plans[p.Role] = append(plans[p.Role], it.RuleId)
		}
	}
	if got := strings.Join(plans[httpapi.Mother], ","); got != "glucose-screen,tdap-pregnancy" {
		t.Errorf("mother plan = %s", got)
	}
	if got := strings.Join(plans[httpapi.Partner], ","); got != "tdap-partner" {
		t.Errorf("partner plan = %s", got)
	}

	// Another family's member must not be reachable from this session.
	get("/api/members/00000000-0000-0000-0000-000000000001/plan", http.StatusNotFound, nil)
}
