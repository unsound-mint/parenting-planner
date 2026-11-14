package aiplan

import (
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/rules"
)

func facts() Facts {
	due := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)
	items := []rules.Item{{
		RuleID: "glucose-screen", Title: "Schedule your glucose screening",
		Result: rules.Result{Status: rules.Due, Reason: "You are at week 25.", DueBy: &due},
		Source: rules.Source{Title: "ACOG", URL: "https://example.org/acog", CheckedAt: time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)},
	}}
	return NewFacts("mother", "pregnancy", nil, items, []Mood{{Date: "2026-11-13", Mood: 2, Energy: 2, SleepHours: 5.5}})
}

const good = `{"intro":"A calm week ahead.","sections":[{"title":"For you","points":[
 {"text":"Book your glucose screening this week.","reason":"It is due at week 25.","ruleId":"glucose-screen"},
 {"text":"You slept about 5.5 hours on average; it may help to share a night with your partner.","reason":"Your own check-ins."}]}]}`

func TestParseAttachesTheRulesOwnSource(t *testing.T) {
	p, err := Parse(good, facts())
	if err != nil {
		t.Fatal(err)
	}
	if p.Fallback || len(p.Sections) != 1 || len(p.Sections[0].Points) != 2 {
		t.Fatalf("plan = %+v", p)
	}
	if pt := p.Sections[0].Points[0]; pt.RuleID != "glucose-screen" || pt.Source == nil || pt.Source.URL != "https://example.org/acog" {
		t.Errorf("a cited rule carries the rule's source: %+v", pt)
	}
	if p.Sections[0].Points[1].Source != nil {
		t.Error("a point that cites no rule has no source")
	}
	// Code fences around the JSON are tolerated.
	if _, err := Parse("```json\n"+good+"\n```", facts()); err != nil {
		t.Errorf("fenced JSON: %v", err)
	}
}

func TestParseRejectsEverythingThatBreaksARule(t *testing.T) {
	big := make([]byte, 301)
	for i := range big {
		big[i] = 'a'
	}
	cases := map[string]string{
		"not json":                 `Here is your plan: be well.`,
		"an unknown field":         `{"intro":"x","sections":[{"title":"t","points":[{"text":"a","reason":"b"}]}],"extra":1}`,
		"no sections":              `{"intro":"x","sections":[]}`,
		"empty intro":              `{"intro":"","sections":[{"title":"t","points":[{"text":"a","reason":"b"}]}]}`,
		"a rule she does not have": `{"intro":"x","sections":[{"title":"t","points":[{"text":"a","reason":"b","ruleId":"tdap-partner"}]}]}`,
		"too long a point":         `{"intro":"x","sections":[{"title":"t","points":[{"text":"` + string(big) + `","reason":"b"}]}]}`,
		"a point without reason":   `{"intro":"x","sections":[{"title":"t","points":[{"text":"a","reason":""}]}]}`,
		"too many points":          `{"intro":"x","sections":[{"title":"t","points":[` + points(6) + `]}]}`,
		"a diagnosis":              `{"intro":"x","sections":[{"title":"t","points":[{"text":"You have depression.","reason":"b"}]}]}`,
		"a diagnosis in intro":     `{"intro":"This looks like a diagnosis of anxiety.","sections":[{"title":"t","points":[{"text":"a","reason":"b"}]}]}`,
		"self-harm":                `{"intro":"x","sections":[{"title":"t","points":[{"text":"If you think about self-harm, call someone.","reason":"b"}]}]}`,
		"an emergency":             `{"intro":"x","sections":[{"title":"t","points":[{"text":"Call 911 now.","reason":"b"}]}]}`,
	}
	for name, text := range cases {
		if _, err := Parse(text, facts()); err == nil {
			t.Errorf("%s: must be rejected", name)
		}
	}
}

func points(n int) string {
	out := ""
	for i := 0; i < n; i++ {
		if i > 0 {
			out += ","
		}
		out += `{"text":"a","reason":"b"}`
	}
	return out
}

func TestUnsafe(t *testing.T) {
	for _, ok := range []string{"Book your glucose screening.", "You slept about 5.5 hours on average.", "Talk to your care team about how you feel."} {
		if Unsafe(ok) {
			t.Errorf("%q is fine", ok)
		}
	}
	for _, bad := range []string{"You are depressed.", "You may have anxiety.", "This is a diagnosis.", "Thoughts of suicide", "call 911", "Call 988"} {
		if !Unsafe(bad) {
			t.Errorf("%q must be flagged", bad)
		}
	}
}

func TestFallbackIsTheRulePlan(t *testing.T) {
	p := Fallback(facts())
	if !p.Fallback || len(p.Sections) != 1 || len(p.Sections[0].Points) != 1 {
		t.Fatalf("fallback = %+v", p)
	}
	pt := p.Sections[0].Points[0]
	if pt.RuleID != "glucose-screen" || pt.Source == nil || pt.Reason == "" {
		t.Errorf("point = %+v", pt)
	}
	if e := Fallback(NewFacts("partner", "pregnancy", nil, nil, nil)); !e.Fallback || len(e.Sections) != 0 || e.Intro == "" {
		t.Errorf("nothing due: %+v", e)
	}
}
