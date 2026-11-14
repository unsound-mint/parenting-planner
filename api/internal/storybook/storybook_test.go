package storybook

import (
	"fmt"
	"strings"
	"testing"
)

var sampleMemories = []string{
	"you held my finger the whole first night",
	"Papa sang the same song again and again!",
	"Grandma knitted a yellow hat that was much too big",
	"we watched the rain from the window together?",
}

// The template is what production shows without a key, so every theme and
// memory count must pass the same checks a model's answer has to pass.
func TestTemplatePassesTheChecksForEveryThemeAndMemoryCount(t *testing.T) {
	for _, theme := range Themes {
		for n := 1; n <= MaxMemories; n++ {
			t.Run(fmt.Sprintf("%s/%d", theme, n), func(t *testing.T) {
				age := 30
				f, err := NewFacts("Leo James", &age, theme, "Mama", sampleMemories[:n])
				if err != nil {
					t.Fatal(err)
				}
				b := Template(f)
				if b.GeneratedBy != "template" {
					t.Errorf("generatedBy = %s", b.GeneratedBy)
				}
				if len(b.Pages) < MinPages || len(b.Pages) > MaxPages {
					t.Errorf("%d pages", len(b.Pages))
				}
				text := b.Title
				for _, p := range b.Pages {
					if !artSet[p.Art] || p.Text == "" || len([]rune(p.Text)) > MaxPageText || strings.ContainsAny(p.Text, "{}") {
						t.Errorf("bad page %+v", p)
					}
					text += " " + p.Text
				}
				if Unsuitable(text) {
					t.Errorf("template text is unsuitable: %s", unsuitable.FindString(text))
				}
				if !strings.Contains(text, "Leo") || strings.Contains(text, "James") {
					t.Errorf("first name only: %s", text)
				}
				for _, m := range sampleMemories[:n] {
					if !strings.Contains(strings.ToLower(text), strings.ToLower(strings.TrimRight(m, "!?"))) {
						t.Errorf("memory %q missing", m)
					}
				}
			})
		}
	}
}

func TestCleanMemory(t *testing.T) {
	for in, want := range map[string]string{
		`  "We walked   to the pond"  `:                      "We walked to the pond",
		"see https://x.example/a and mail me@example.com ok": "see and mail ok",
		"call (617) 555-0133 or visit 42 Elm Street.":        "call or visit",
		"**bold** <b>tag</b> `code`":                         "bold btag/b code",
		"line\nbreak\ttab":                                   "line break tab",
		"your 2nd birthday with 3 candles":                   "your 2nd birthday with 3 candles",
		strings.Repeat("a", 300):                             strings.Repeat("a", MaxMemory),
	} {
		if got := CleanMemory(in); got != want {
			t.Errorf("CleanMemory(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNewFactsNeedsANameASignatureAndAMemory(t *testing.T) {
	if _, err := NewFacts("", nil, Bedtime, "Mama", []string{"a walk"}); err == nil {
		t.Error("no name")
	}
	if _, err := NewFacts("Ava", nil, Bedtime, " ", []string{"a walk"}); err == nil {
		t.Error("no signedAs")
	}
	if _, err := NewFacts("Ava", nil, Bedtime, "Mama", []string{"555 0133", " "}); err != ErrNoMemory {
		t.Error("no usable memory")
	}
}

func TestParseRejectsWhatAChildShouldNotRead(t *testing.T) {
	f := Facts{ChildName: "Ava"}
	page := func(text string) string { return fmt.Sprintf(`{"text":%q,"art":"moon"}`, text) }
	book := func(pages ...string) string {
		return `{"title":"Ava's Night","pages":[` + strings.Join(pages, ",") + `]}`
	}
	six := func(last string) string {
		return book(page("Ava yawned."), page("The moon smiled."), page("Stars blinked."), page("Mama hummed."), page("Ava snuggled."), page(last))
	}
	if b, err := Parse("```json\n"+six("Goodnight, Ava.")+"\n```", f); err != nil || len(b.Pages) != 6 {
		t.Fatalf("a good answer is accepted: %v", err)
	}
	for name, text := range map[string]string{
		"medical":     six("The nurse said goodnight."),
		"fear":        six("A monster hid under the bed."),
		"link":        six("Visit www.example.com tonight."),
		"digits":      six("Ava slept 8 hours."),
		"urgent":      six("Call 911 in an emergency."),
		"extra field": `{"title":"x","pages":[],"moral":"y"}`,
		"too many":    book(strings.Split(strings.Repeat(page("Ava.")+"|", 11), "|")[:11]...),
		"long page":   six(strings.Repeat("Ava ", 90)),
	} {
		if _, err := Parse(text, f); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}
