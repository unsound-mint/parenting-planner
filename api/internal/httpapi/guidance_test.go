package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// The sources page is public and lists each page once, with a checked date.
func TestGuidanceSourcesArePublicAndDeduplicated(t *testing.T) {
	var got struct{ Items []httpapi.GuidanceSource }
	testutil.New(t).Get("/api/guidance-sources", http.StatusOK, &got)
	if len(got.Items) < 50 {
		t.Fatalf("got %d sources, want the whole catalog", len(got.Items))
	}
	seen := map[string]bool{}
	topics := map[httpapi.GuidanceSourceTopic]bool{}
	for _, s := range got.Items {
		if seen[s.Url] {
			t.Errorf("%s listed twice", s.Url)
		}
		seen[s.Url] = true
		topics[s.Topic] = true
		if s.Organization == "" || s.Title == "" || s.CheckedAt.IsZero() {
			t.Errorf("incomplete source %+v", s)
		}
	}
	for _, want := range []httpapi.GuidanceSourceTopic{httpapi.GuidanceSourceTopicPregnancy, httpapi.GuidanceSourceTopicNewborn, httpapi.GuidanceSourceTopicChild, httpapi.GuidanceSourceTopicMentalHealth} {
		if !topics[want] {
			t.Errorf("no sources under %s", want)
		}
	}
}
