package httpapi_test

// A small load test for docs/security-review.md (#134). It is skipped unless
// LOAD_TEST=1, so `go test ./...` and CI do not run it:
//
//	LOAD_TEST=1 LOAD_SESSIONS=50 LOAD_ROUNDS=10 LOAD_WORKERS=25 \
//	TEST_DATABASE_URL=... go test ./internal/httpapi -run TestLoad -v
//
// It starts one API server on the test database, creates LOAD_SESSIONS demo
// families (each with its own cookie, as separate visitors), then sends
// GET /plan, /passport and /journey for each family's mother LOAD_ROUNDS
// times from LOAD_WORKERS goroutines, and logs p50/p95/p99 and errors.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func envInt(key string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(key)); err == nil && n > 0 {
		return n
	}
	return def
}

type sample struct {
	endpoint string
	d        time.Duration
	err      bool
}

func TestLoad(t *testing.T) {
	if os.Getenv("LOAD_TEST") != "1" {
		t.Skip("set LOAD_TEST=1 to run the load test")
	}
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	sessions, rounds, workers := envInt("LOAD_SESSIONS", 50), envInt("LOAD_ROUNDS", 10), envInt("LOAD_WORKERS", 25)

	pool, err := store.Open(context.Background(), dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	// Every load client comes from 127.0.0.1, so the per-address limit is off.
	h, err := httpapi.New(pool, httpapi.Config{SessionLimit: httpapi.Limit{N: -1}})
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	defer srv.Close()
	transport := &http.Transport{MaxIdleConnsPerHost: workers}

	type visitor struct {
		client *http.Client
		mother string
	}
	templates := []string{"pregnancy", "newborn", "preschool"}
	visitors := make([]visitor, sessions)
	var mu sync.Mutex
	var samples []sample
	record := func(s sample) {
		mu.Lock()
		samples = append(samples, s)
		mu.Unlock()
	}

	// Phase 1: create the sessions concurrently.
	start := time.Now()
	var wg sync.WaitGroup
	sem := make(chan struct{}, workers)
	for i := range visitors {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			jar, _ := cookiejar.New(nil)
			c := &http.Client{Jar: jar, Transport: transport, Timeout: 30 * time.Second}
			body := `{"template":"` + templates[i%len(templates)] + `"}`
			t0 := time.Now()
			res, err := c.Post(srv.URL+"/api/demo/sessions", "application/json", strings.NewReader(body))
			d := time.Since(t0)
			if err != nil || res.StatusCode != http.StatusCreated {
				record(sample{"POST /demo/sessions", d, true})
				if res != nil {
					res.Body.Close()
				}
				return
			}
			var fam httpapi.Family
			_ = json.NewDecoder(res.Body).Decode(&fam)
			res.Body.Close()
			record(sample{"POST /demo/sessions", d, false})
			for _, p := range fam.Parents {
				if p.Role == httpapi.ParentRoleMother {
					visitors[i] = visitor{client: c, mother: p.Id.String()}
				}
			}
		}()
	}
	wg.Wait()
	seedTime := time.Since(start)

	// Phase 2: the three read endpoints, concurrently.
	start = time.Now()
	endpoints := []string{"plan", "passport", "journey"}
	for range rounds {
		for _, v := range visitors {
			if v.client == nil {
				continue
			}
			for _, ep := range endpoints {
				wg.Add(1)
				sem <- struct{}{}
				go func() {
					defer wg.Done()
					defer func() { <-sem }()
					t0 := time.Now()
					res, err := v.client.Get(srv.URL + "/api/members/" + v.mother + "/" + ep)
					d := time.Since(t0)
					bad := err != nil || res.StatusCode != http.StatusOK
					if res != nil {
						_, _ = io.Copy(io.Discard, res.Body)
						res.Body.Close()
					}
					record(sample{"GET /" + ep, d, bad})
				}()
			}
		}
	}
	wg.Wait()
	readTime := time.Since(start)

	t.Logf("sessions=%d rounds=%d workers=%d GOMAXPROCS=%d pgxpool.MaxConns=%d", sessions, rounds, workers, runtime.GOMAXPROCS(0), pool.Config().MaxConns)
	t.Logf("seeding took %v, reads took %v", seedTime.Round(time.Millisecond), readTime.Round(time.Millisecond))
	t.Logf("| Endpoint | Requests | Errors | p50 | p95 | p99 | max |")
	t.Logf("| --- | --- | --- | --- | --- | --- | --- |")
	reads := 0
	for _, ep := range []string{"POST /demo/sessions", "GET /plan", "GET /passport", "GET /journey"} {
		var ds []time.Duration
		errs := 0
		for _, s := range samples {
			if s.endpoint == ep {
				ds = append(ds, s.d)
				if s.err {
					errs++
				}
			}
		}
		if ep != "POST /demo/sessions" {
			reads += len(ds)
		}
		slices.Sort(ds)
		pct := func(p float64) string {
			if len(ds) == 0 {
				return "-"
			}
			return fmt.Sprintf("%.1f ms", float64(ds[int(float64(len(ds)-1)*p)])/1e6)
		}
		t.Logf("| %s | %d | %d | %s | %s | %s | %s |", ep, len(ds), errs, pct(0.50), pct(0.95), pct(0.99), pct(1))
		if errs > 0 {
			t.Errorf("%s: %d errors", ep, errs)
		}
	}
	t.Logf("read throughput: %.0f requests/s", float64(reads)/readTime.Seconds())
}
