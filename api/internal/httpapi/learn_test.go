package httpapi_test

import (
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Replace each case with the reference tests (see wellbeing_test.go) when
// its handler lands.
func TestLearnAndTogetherAreNotImplementedYet(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	name := "/baby-names/00000000-0000-4000-8000-000000000001/like"
	for _, call := range []stubCall{
		{"GET", m + "/learning-paths", nil},
		{"PUT", m + "/lesson-reads/pain-relief", map[string]any{"finished": true}},
		{"POST", m + "/quiz-answers", map[string]any{"questionId": "pain-relief-q1", "choiceId": "a"}},
		{"GET", m + "/together", nil},
		{"POST", m + "/couple-talks", map[string]any{"promptId": "p07"}},
		{"GET", m + "/baby-names", nil},
		{"POST", m + "/baby-names", map[string]any{"name": "June"}},
		{"PUT", m + name, nil},
		{"DELETE", m + name, nil},
	} {
		call.expectNotImplemented(t, c)
	}
}
