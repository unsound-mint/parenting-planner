package httpapi_test

// Regression tests for the fixes in docs/security-review.md (#134).

import (
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/ai"
	"github.com/unsound-mint/parenting-planner/api/internal/carelog"
	"github.com/unsound-mint/parenting-planner/api/internal/demo"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestNewDemosAreRateLimitedPerAddress(t *testing.T) {
	c := testutil.NewWithConfig(t, httpapi.Config{SessionLimit: httpapi.Limit{N: 2, Window: time.Hour}})
	c.StartDemo("pregnancy")
	c.StartDemo("newborn")

	var e httpapi.Error
	c.Post("/api/demo/sessions", map[string]string{"template": "pregnancy"}, http.StatusTooManyRequests, &e)
	if e.Code != "rate_limited" || c.LastHeader.Get("Retry-After") == "" {
		t.Errorf("error = %+v, Retry-After %q", e, c.LastHeader.Get("Retry-After"))
	}
	// Custom families share the budget: both seed a whole family.
	c.Post("/api/demo/custom-sessions", map[string]any{"stage": "planning", "motherName": "A", "partnerName": "B"}, http.StatusTooManyRequests, nil)
	// Other endpoints are not limited.
	c.Get("/api/healthz", http.StatusOK, nil)
}

func TestRequestBodiesAreCapped(t *testing.T) {
	c := testutil.New(t)
	big := `{"template":"pregnancy","x":"` + strings.Repeat("a", 3<<20) + `"}`
	code, raw := c.Raw(http.MethodPost, "/api/demo/sessions", "application/json", strings.NewReader(big))
	if code != http.StatusRequestEntityTooLarge {
		t.Errorf("declared 3 MB body: status %d, want 413", code)
	}
	if strings.Contains(string(raw), "aaaa") {
		t.Error("the error must not echo the body")
	}
	// Without a declared length, reading stops at the cap and the request is refused.
	code, _ = c.Raw(http.MethodPost, "/api/demo/sessions", "application/json", io.MultiReader(strings.NewReader(big)))
	if code != http.StatusBadRequest {
		t.Errorf("streamed 3 MB body: status %d, want 400", code)
	}
}

func TestSecurityHeadersOnEveryResponse(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/healthz", http.StatusOK, nil)
	for k, want := range map[string]string{
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy":        "no-referrer",
		"X-Frame-Options":        "DENY",
		"Cache-Control":          "no-store",
	} {
		if got := c.LastHeader.Get(k); got != want {
			t.Errorf("%s = %q, want %q", k, got, want)
		}
	}
	if !strings.Contains(c.LastHeader.Get("Content-Security-Policy"), "frame-ancestors 'none'") {
		t.Errorf("CSP = %q", c.LastHeader.Get("Content-Security-Policy"))
	}
	// Error answers too.
	c.Get("/api/family", http.StatusUnauthorized, nil)
	if c.LastHeader.Get("X-Content-Type-Options") != "nosniff" {
		t.Error("401 lacks nosniff")
	}
}

func TestSessionCookieFlags(t *testing.T) {
	c := testutil.NewWithConfig(t, httpapi.Config{SecureCookies: true})
	c.StartDemo("pregnancy")
	sc := c.LastHeader.Get("Set-Cookie")
	for _, want := range []string{"pp_session=", "HttpOnly", "Secure", "SameSite=Lax", "Path=/"} {
		if !strings.Contains(sc, want) {
			t.Errorf("Set-Cookie %q lacks %s", sc, want)
		}
	}
}

func TestDemoClockStopsAtTheBound(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	near := demo.MaxOffsetDays - demo.SkipDays + 1 // one more skip would pass the bound
	if _, err := c.Pool.Exec(t.Context(), `UPDATE families SET demo_offset_days = $1 WHERE id = $2`, near, fam.Id); err != nil {
		t.Fatal(err)
	}
	moods := func() int {
		var n int
		if err := c.Pool.QueryRow(t.Context(), `SELECT count(*) FROM mood_checkins WHERE family_id = $1`, fam.Id).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	before := moods()
	c.Post("/api/family/demo-time-skips", nil, http.StatusOK, nil)
	var offset int
	if err := c.Pool.QueryRow(t.Context(), `SELECT demo_offset_days FROM families WHERE id = $1`, fam.Id).Scan(&offset); err != nil {
		t.Fatal(err)
	}
	if offset != near {
		t.Errorf("offset = %d, want it to stay at %d", offset, near)
	}
	if moods() != before {
		t.Error("a skip at the bound must not copy check-ins")
	}
}

func TestHandoffOnlyNamesAShiftOfThisFamily(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.nanny.Id, "shiftId": uuid.New()}, http.StatusConflict, nil)

	other := testutil.New(t)
	op := newbornFamily(other, t)
	insertShift := `INSERT INTO shifts (family_id, member_id, title, days, start_time, end_time, status)
		VALUES ($1, $2, 'Mornings', '{mon}', '08:00', '12:00', 'agreed') RETURNING id`
	var foreign, own uuid.UUID
	if err := c.Pool.QueryRow(t.Context(), insertShift, op.fam.Id, op.nanny.Id).Scan(&foreign); err != nil {
		t.Fatal(err)
	}
	if err := c.Pool.QueryRow(t.Context(), insertShift, p.fam.Id, p.nanny.Id).Scan(&own); err != nil {
		t.Fatal(err)
	}
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.nanny.Id, "shiftId": foreign}, http.StatusConflict, nil)
	var h httpapi.Handoff
	c.Post(handoffs(p.mom.Id), map[string]any{"toMemberId": p.nanny.Id, "shiftId": own}, http.StatusCreated, &h)
	if h.ShiftId == nil || *h.ShiftId != own {
		t.Errorf("shiftId = %v, want %v", h.ShiftId, own)
	}
}

func TestCaregiverCalendarReadIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	var nanny httpapi.Caregiver
	for _, cg := range fam.Caregivers {
		if cg.Role == httpapi.CaregiverRoleNanny {
			nanny = cg
		}
	}
	before := c.AuditCount(fam.Id, "read", "calendar_event")
	c.Get("/api/members/"+nanny.Id.String()+"/calendar-events", http.StatusOK, nil)
	if got := c.AuditCount(fam.Id, "read", "calendar_event"); got != before+1 {
		t.Errorf("calendar read audit rows = %d, want %d", got, before+1)
	}
}

func TestUnattachedVoiceNotesAreCappedPerUploader(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	var ids []uuid.UUID
	for i := range carelog.MaxUnattached + 2 {
		code, n := uploadVoiceNote(t, c, voiceNotesPath(p.mom), "audio/webm", []byte{byte(i)})
		if code != http.StatusCreated {
			t.Fatalf("upload %d: status %d", i, code)
		}
		ids = append(ids, n.Id)
		// The test clock is fixed; spread the uploads out so "oldest" is defined.
		at := testutil.Now.Add(-time.Duration(carelog.MaxUnattached+2-i) * time.Minute)
		if _, err := c.Pool.Exec(t.Context(), `UPDATE voice_notes SET created_at = $1 WHERE id = $2`, at, n.Id); err != nil {
			t.Fatal(err)
		}
	}
	// The partner's notes are not touched by the mother's uploads.
	_, partnerNote := uploadVoiceNote(t, c, voiceNotesPath(p.partner), "audio/webm", []byte("p"))
	uploadVoiceNote(t, c, voiceNotesPath(p.mom), "audio/webm", []byte("last"))

	var n int
	if err := c.Pool.QueryRow(t.Context(), `SELECT count(*) FROM voice_notes WHERE family_id = $1 AND uploader_member_id = $2`, p.fam.Id, p.mom.Id).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != carelog.MaxUnattached {
		t.Errorf("mother keeps %d waiting notes, want %d", n, carelog.MaxUnattached)
	}
	// The newest stay playable; the oldest are gone.
	if code, _ := c.Raw(http.MethodGet, voiceNotesPath(p.mom)+"/"+ids[len(ids)-1].String(), "", nil); code != http.StatusOK {
		t.Errorf("newest note: status %d", code)
	}
	if code, _ := c.Raw(http.MethodGet, voiceNotesPath(p.mom)+"/"+ids[0].String(), "", nil); code != http.StatusNotFound {
		t.Errorf("oldest note: status %d, want 404", code)
	}
	if code, _ := c.Raw(http.MethodGet, voiceNotesPath(p.partner)+"/"+partnerNote.Id.String(), "", nil); code != http.StatusOK {
		t.Errorf("partner's note: status %d", code)
	}
}

func TestClaudeCallsAreLimitedPerFamily(t *testing.T) {
	f := &fakeClaude{text: claudeGood}
	srv := f.server(t)
	c := testutil.NewWithConfig(t, httpapi.Config{
		AI:          ai.Config{APIKey: ai.Secret("test-key"), Model: "test-model", BaseURL: srv.URL, Timeout: 500 * time.Millisecond},
		AIPlanLimit: httpapi.Limit{N: 2, Window: time.Hour},
	})
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	var p httpapi.WeeklyPlan
	for range 2 {
		c.Get(weeklyPath(mom.Id), http.StatusOK, &p)
		if p.Fallback {
			t.Fatal("within the limit the model answers")
		}
	}
	c.Get(weeklyPath(mom.Id), http.StatusOK, &p)
	if !p.Fallback || len(p.Sections) == 0 {
		t.Errorf("past the limit the rule plan is shown: %+v", p)
	}
	f.mu.Lock()
	calls := len(f.requests)
	f.mu.Unlock()
	if calls != 2 {
		t.Errorf("Claude was called %d times, want 2", calls)
	}
	// Another family has its own budget.
	other := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	c.Get(weeklyPath(other.Id), http.StatusOK, &p)
	if p.Fallback {
		t.Error("another family is not limited by the first")
	}
}
