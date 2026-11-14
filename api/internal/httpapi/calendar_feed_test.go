package httpapi_test

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func feedLink(t *testing.T, c *testutil.Client, member, scope string) string {
	t.Helper()
	var feed httpapi.CalendarFeed
	c.Post(member+"/calendar-feed", map[string]string{"scope": scope}, http.StatusCreated, &feed)
	if feed.Url == nil || !feed.Active || feed.Scope == nil || string(*feed.Scope) != scope {
		t.Fatalf("create feed: %+v", feed)
	}
	link, err := url.Parse(*feed.Url)
	if err != nil || link.Host == "" {
		t.Fatalf("invalid subscription origin: %v", err)
	}
	return link.Path
}

func TestCalendarFeedRotationAndVisibility(t *testing.T) {
	c := testutil.New(t)
	anonymous := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	member := "/api/members/" + mom.Id.String()
	var status httpapi.CalendarFeed
	anonymous.Get("/api/calendar-feeds/0123456789abcdef0123456789abcdef", http.StatusNotFound, nil)
	c.Get(member+"/calendar-feed", http.StatusOK, &status)
	if status.Active {
		t.Fatal("a new family has no subscription")
	}
	c.Post(calBase(mom), event("Mine, private; yes", "private", 24*time.Hour), http.StatusCreated, nil)
	c.Post(calBase(partner), event("Partner private", "private", 48*time.Hour), http.StatusCreated, nil)
	c.Post(calBase(partner), event("Family far ahead", "family", 180*24*time.Hour), http.StatusCreated, nil)
	c.Post(calBase(partner), event("Outside window", "family", 181*24*time.Hour), http.StatusCreated, nil)

	first := feedLink(t, c, member, "mine")
	code, data := anonymous.Raw(http.MethodGet, first, "", nil)
	if code != http.StatusOK || !strings.Contains(string(data), "SUMMARY:Mine\\, private\\; yes\r\n") ||
		strings.Contains(string(data), "Family far ahead") || strings.Contains(string(data), "Partner private") {
		t.Fatalf("mine status=%d body=%s", code, data)
	}
	c.Get(member+"/calendar-feed", http.StatusOK, &status)
	if !status.Active || status.Url != nil || status.LastFetchedAt == nil {
		t.Fatalf("feed status leaks URL or has no last fetch: %+v", status)
	}
	second := feedLink(t, c, member, "family")
	if first == second {
		t.Fatal("rotating must change the token")
	}
	anonymous.Get(first, http.StatusNotFound, nil)
	code, data = anonymous.Raw(http.MethodGet, second, "", nil)
	if code != http.StatusOK || !strings.Contains(string(data), "SUMMARY:Family far ahead\r\n") ||
		strings.Contains(string(data), "Outside window") || strings.Contains(string(data), "Partner private") {
		t.Fatalf("family status=%d body=%s", code, data)
	}
	c.Delete(member+"/calendar-feed", http.StatusNoContent, nil)
	c.Delete(member+"/calendar-feed", http.StatusNoContent, nil)
	anonymous.Get(second, http.StatusNotFound, nil)
}

func TestCalendarFeedRechecksCaregiverPermission(t *testing.T) {
	c := testutil.New(t)
	p := newbornFamily(c, t)
	member := "/api/members/" + p.nanny.Id.String()
	c.Post(member+"/calendar-feed", map[string]string{"scope": "family"}, http.StatusForbidden, nil)
	link := feedLink(t, c, member, "mine")
	c.Get(link, http.StatusOK, nil)
	if _, err := c.Pool.Exec(t.Context(), "UPDATE members SET permissions = '{}' WHERE id = $1", p.nanny.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(link, http.StatusNotFound, nil)
	c.Get(member+"/calendar-feed", http.StatusForbidden, nil)
}
