package httpapi_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// A caregiver's session is bound to the caregiver. With a parent's id in the
// path, every /members/{memberId}/... route must answer 404 "no such parent"
// before reading anything: a nanny never sees a mother's mood, diary, labs,
// screenings or session notes. The routes come from openapi.yaml, so a new
// route is covered as soon as it is in the contract. Each request is valid for
// the contract (path parameters, query and body), otherwise the validator
// would answer 400 before the handler's session check ran.
func TestCaregiverSessionCannotActAsAParent(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	var created httpapi.CreatedInvitation
	c.Post(invitePath(testutil.Parent(t, fam, httpapi.ParentRoleMother)), inviteBody("nanny", "care_log", "baby_passport", "schedule", "family_plan", "pregnancy_updates"), http.StatusCreated, &created)
	nanny := testutil.New(t)
	var got httpapi.InvitationAcceptance
	nanny.Post("/api/invitations/"+created.Token+"/accept", nil, http.StatusCreated, &got)

	spec, err := httpapi.GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	paths := spec.Paths.Map()
	keys := make([]string, 0, len(paths))
	for p := range paths {
		if strings.HasPrefix(p, "/members/{memberId}") {
			keys = append(keys, p)
		}
	}
	sort.Strings(keys)

	checked := 0
	for _, p := range keys {
		item := paths[p]
		for method, op := range item.Operations() {
			for _, parent := range fam.Parents {
				target, ct, body := sampleRequest(t, p, item, op, parent.Id)
				name := fmt.Sprintf("%s %s as %s", method, p, parent.Role)
				code, raw := nanny.Raw(method, target, ct, bytes.NewReader(body))
				if code == http.StatusNotImplemented {
					// A 501 stub reads nothing; it must answer 501 to a parent too.
					if pc, _ := c.Raw(method, target, ct, bytes.NewReader(body)); pc != http.StatusNotImplemented {
						t.Errorf("%s: the caregiver got 501 but the parent got %d", name, pc)
					}
					continue
				}
				var e httpapi.Error
				_ = json.Unmarshal(raw, &e)
				if code != http.StatusNotFound || e.Message != "no such parent in this family" {
					t.Errorf("%s: status %d, want 404 no such parent; body: %s", name, code, raw)
				}
				checked++
			}
		}
	}
	if checked < 40 {
		t.Errorf("only %d routes checked; the route walk is broken", checked)
	}

	// The caregiver still acts as themselves.
	me := "/api/members/" + got.MemberId.String()
	nanny.Get(me+"/invitations", http.StatusForbidden, nil)
	nanny.Get("/api/family", http.StatusOK, nil)
}

// sampleRequest builds a request for op that the contract accepts.
func sampleRequest(t *testing.T, path string, item *openapi3.PathItem, op *openapi3.Operation, memberID uuid.UUID) (string, string, []byte) {
	t.Helper()
	q := url.Values{}
	params := append(append(openapi3.Parameters{}, item.Parameters...), op.Parameters...)
	for _, ref := range params {
		prm := ref.Value
		if prm.In == openapi3.ParameterInPath {
			v := memberID.String()
			if prm.Name != "memberId" {
				v = fmt.Sprint(sampleValue(prm.Schema.Value))
			}
			path = strings.ReplaceAll(path, "{"+prm.Name+"}", v)
		}
		if prm.In == openapi3.ParameterInQuery && prm.Required {
			q.Set(prm.Name, fmt.Sprint(sampleValue(prm.Schema.Value)))
		}
	}
	target := "/api" + path
	if len(q) > 0 {
		target += "?" + q.Encode()
	}
	if op.RequestBody == nil || op.RequestBody.Value == nil {
		return target, "", nil
	}
	content := op.RequestBody.Value.Content
	if mt := content.Get("application/json"); mt != nil {
		b, err := json.Marshal(sampleValue(mt.Schema.Value))
		if err != nil {
			t.Fatal(err)
		}
		return target, "application/json", b
	}
	for ct := range content {
		if strings.HasPrefix(ct, "audio/") {
			return target, "audio/webm", []byte("fake opus frames")
		}
	}
	t.Fatalf("%s: no sample body for content types %v", path, content)
	return "", "", nil
}

// samplePatterns are values for the string patterns used in openapi.yaml.
var samplePatterns = map[string]string{
	"^[A-Z]{2}$":                      "CA",
	"^([01][0-9]|2[0-3]):[0-5][0-9]$": "09:00",
	"^https://":                       "https://example.com",
	"^[a-z0-9-]{1,80}$":               "week-25",
}

// sampleValue is the smallest value the schema accepts: required fields only,
// the first enum value, the minimum length, count or number.
func sampleValue(s *openapi3.Schema) any {
	switch {
	case len(s.Enum) > 0:
		return s.Enum[0]
	case len(s.AllOf) > 0:
		out := map[string]any{}
		for _, sub := range s.AllOf {
			if m, ok := sampleValue(sub.Value).(map[string]any); ok {
				for k, v := range m {
					out[k] = v
				}
			}
		}
		return out
	case len(s.OneOf) > 0:
		return sampleValue(s.OneOf[0].Value)
	case len(s.AnyOf) > 0:
		return sampleValue(s.AnyOf[0].Value)
	}
	switch {
	case s.Type.Is("object") || len(s.Properties) > 0:
		out := map[string]any{}
		for _, k := range s.Required {
			out[k] = sampleValue(s.Properties[k].Value)
		}
		// minProperties: add optional fields in name order until there are enough.
		names := make([]string, 0, len(s.Properties))
		for k := range s.Properties {
			names = append(names, k)
		}
		sort.Strings(names)
		for _, k := range names {
			if uint64(len(out)) >= s.MinProps {
				break
			}
			if _, ok := out[k]; !ok {
				out[k] = sampleValue(s.Properties[k].Value)
			}
		}
		return out
	case s.Type.Is("array"):
		items := []any{}
		item := s.Items.Value
		for i := 0; i < int(s.MinItems); i++ {
			v := sampleValue(item)
			if len(item.Enum) > i {
				v = item.Enum[i] // unique items
			}
			items = append(items, v)
		}
		return items
	case s.Type.Is("integer") || s.Type.Is("number"):
		if s.Min != nil {
			return int(*s.Min)
		}
		return 1
	case s.Type.Is("boolean"):
		return false
	}
	if v, ok := samplePatterns[s.Pattern]; ok {
		return v
	}
	switch s.Format {
	case "uuid":
		return uuid.NewString()
	case "date":
		return testutil.Now.Format("2006-01-02")
	case "date-time":
		return testutil.Now.Format("2006-01-02T15:04:05Z")
	case "uri":
		return "https://example.com"
	}
	return strings.Repeat("x", max(1, int(s.MinLength)))
}
