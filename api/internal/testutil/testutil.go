// Package testutil runs the real HTTP API against a real Postgres for
// integration tests. Every endpoint gets at least one test written with it.
//
//	c := testutil.New(t)                  // skips if TEST_DATABASE_URL is unset
//	fam := c.StartDemo("pregnancy")       // fresh family + session cookie
//	c.Post("/api/...", body, 201, &out)   // fails the test on any other status
package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Now is the fixed clock every integration test runs at.
var Now = time.Date(2026, 11, 14, 15, 0, 0, 0, time.UTC)

type Client struct {
	t    *testing.T
	base string
	http *http.Client
	Pool *pgxpool.Pool
	// LastHeader holds the response headers of the last request.
	LastHeader http.Header
}

func New(t *testing.T) *Client {
	t.Helper()
	return NewWithConfig(t, httpapi.Config{})
}

// NewWithConfig is New with a custom server config; Now defaults to the fixed clock.
func NewWithConfig(t *testing.T, cfg httpapi.Config) *Client {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set; run `make test`")
	}
	pool, err := store.Open(context.Background(), dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if cfg.Now == nil {
		cfg.Now = func() time.Time { return Now }
	}
	h, err := httpapi.New(pool, cfg)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	jar, _ := cookiejar.New(nil)
	return &Client{t: t, base: srv.URL, http: &http.Client{Jar: jar}, Pool: pool}
}

// StartDemo creates a demo family and keeps its session cookie for later calls.
func (c *Client) StartDemo(template string) httpapi.Family {
	c.t.Helper()
	var fam httpapi.Family
	c.Post("/api/demo/sessions", map[string]string{"template": template}, http.StatusCreated, &fam)
	return fam
}

// Parent returns the family's parent with the given role.
func Parent(t *testing.T, fam httpapi.Family, role httpapi.ParentRole) httpapi.Parent {
	t.Helper()
	for _, p := range fam.Parents {
		if p.Role == role {
			return p
		}
	}
	t.Fatalf("family has no %s", role)
	return httpapi.Parent{}
}

func (c *Client) Get(path string, wantStatus int, out any) {
	c.t.Helper()
	c.do(http.MethodGet, path, nil, wantStatus, out)
}

func (c *Client) Post(path string, body any, wantStatus int, out any) {
	c.t.Helper()
	c.do(http.MethodPost, path, body, wantStatus, out)
}

func (c *Client) Put(path string, body any, wantStatus int, out any) {
	c.do(http.MethodPut, path, body, wantStatus, out)
}

func (c *Client) Patch(path string, body any, wantStatus int, out any) {
	c.t.Helper()
	c.do(http.MethodPatch, path, body, wantStatus, out)
}

func (c *Client) Delete(path string, wantStatus int, out any) {
	c.t.Helper()
	c.do(http.MethodDelete, path, nil, wantStatus, out)
}

// PostWithHeaders is Post with extra request headers, for callers such as
// webhooks that authenticate with a header instead of the session cookie.
func (c *Client) PostWithHeaders(path string, headers map[string]string, body any, wantStatus int, out any) {
	c.t.Helper()
	c.doWithHeaders(http.MethodPost, path, headers, body, wantStatus, out)
}

func (c *Client) do(method, path string, body any, wantStatus int, out any) {
	c.t.Helper()
	c.doWithHeaders(method, path, nil, body, wantStatus, out)
}

func (c *Client) doWithHeaders(method, path string, headers map[string]string, body any, wantStatus int, out any) {
	c.t.Helper()
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			c.t.Fatal(err)
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.base+path, r)
	if err != nil {
		c.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	c.LastHeader = res.Header
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode != wantStatus {
		c.t.Fatalf("%s %s: status %d, want %d; body: %s", method, path, res.StatusCode, wantStatus, raw)
	}
	if out != nil {
		if err := json.Unmarshal(raw, out); err != nil {
			c.t.Fatalf("%s %s: decode: %v; body: %s", method, path, err, raw)
		}
	}
}

// SessionCookie is the pp_session value the client holds, or "" if none.
func (c *Client) SessionCookie() string {
	c.t.Helper()
	u, err := url.Parse(c.base)
	if err != nil {
		c.t.Fatal(err)
	}
	for _, ck := range c.http.Jar.Cookies(u) {
		if ck.Name == "pp_session" {
			return ck.Value
		}
	}
	return ""
}

// SetSessionCookie makes the client send this pp_session value, e.g. an old
// one kept from before the session ended.
func (c *Client) SetSessionCookie(value string) {
	c.t.Helper()
	u, err := url.Parse(c.base)
	if err != nil {
		c.t.Fatal(err)
	}
	c.http.Jar.SetCookies(u, []*http.Cookie{{Name: "pp_session", Value: value, Path: "/"}})
}

// AuditCount counts audit rows for a family, action and entity.
func (c *Client) AuditCount(familyID any, action, entity string) int {
	c.t.Helper()
	var n int
	err := c.Pool.QueryRow(context.Background(),
		`SELECT count(*) FROM audit_log WHERE family_id = $1 AND action = $2 AND entity = $3`,
		familyID, action, entity).Scan(&n)
	if err != nil {
		c.t.Fatal(err)
	}
	return n
}

// Raw sends a body that is not JSON (an audio upload) or reads a body that is
// not JSON (a calendar feed) and returns the status and the raw response.
func (c *Client) Raw(method, path, contentType string, body io.Reader) (int, []byte) {
	c.t.Helper()
	req, err := http.NewRequest(method, c.base+path, body)
	if err != nil {
		c.t.Fatal(err)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	res, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	c.LastHeader = res.Header
	raw, _ := io.ReadAll(res.Body)
	return res.StatusCode, raw
}
