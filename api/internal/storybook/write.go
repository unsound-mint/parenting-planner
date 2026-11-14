// Package storybook makes short picture-book stories from memories a parent
// chose, and stores them private to their author until shared.
//
// What a story is made from: the child's first name, their age in months, the
// theme, what the child calls the author and one to four memory lines the
// parent picked or typed. Nothing else, never photos. With a Claude API key
// the model writes the text; its answer is checked (page count, length, art,
// no medical or frightening words, no links or numbers) and any failure falls
// back to the built-in template, which is also what runs with no key.
package storybook

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/unsound-mint/parenting-planner/api/internal/ai"
	"github.com/unsound-mint/parenting-planner/api/internal/aiplan"
)

// Model is a small fast model: a picture book is short and the parent waits for it.
const Model = "claude-haiku-5-5"

const (
	MinPages     = 6
	MaxPages     = 10
	MaxPageText  = 320
	MaxTitle     = 70
	MaxMemory    = 280
	MaxMemories  = 4
	maxNameRunes = 40
)

type Theme string

const (
	Bedtime   Theme = "bedtime"
	Adventure Theme = "adventure"
	Born      Theme = "born"
	Sibling   Theme = "sibling"
)

var Themes = []Theme{Bedtime, Adventure, Born, Sibling}

// Art is the illustration scene the web draws behind a page.
var Art = []string{"moon", "stars", "sunrise", "garden", "home", "hearts", "journey", "cuddle"}

type Page struct {
	Text string `json:"text"`
	Art  string `json:"art"`
}

type Book struct {
	Title       string
	Pages       []Page
	GeneratedBy string // "ai" or "template"
}

// Facts is everything a story is made from, and all the model is told.
type Facts struct {
	ChildName string   `json:"childFirstName"`
	AgeMonths *int     `json:"ageMonths,omitempty"`
	Theme     Theme    `json:"theme"`
	SignedAs  string   `json:"signedAs"`
	Memories  []string `json:"memories"`
}

var ErrNoMemory = errors.New("no usable memory")

var (
	links    = regexp.MustCompile(`(?i)https?://\S+|www\.\S+|\S+@\S+\.\S+`)
	digits   = regexp.MustCompile(`\(?\d[\d\s\-().]{2,}\d\)?|\d{3,}`)
	address  = regexp.MustCompile(`(?i)\b\d+\s+(\w+\s+){1,3}(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|way|court|ct|place|pl)\b\.?`)
	spaces   = regexp.MustCompile(`\s+`)
	oddChars = regexp.MustCompile("[*_#<>`|~\\[\\]{}]")
)

// clean collapses whitespace and drops control characters and markup.
func clean(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, s)
	s = oddChars.ReplaceAllString(s, "")
	return strings.TrimSpace(spaces.ReplaceAllString(s, " "))
}

func truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return strings.TrimSpace(string(r[:n]))
}

// CleanMemory keeps a memory line fit for a children's book and for the model:
// no links, emails or long numbers (phone numbers, house numbers), no quotes
// around it, at most MaxMemory characters.
func CleanMemory(s string) string {
	s = links.ReplaceAllString(s, "")
	s = address.ReplaceAllString(s, "")
	s = digits.ReplaceAllString(s, "")
	s = clean(s)
	s = strings.Trim(s, `"'“”‘’ `)
	return truncate(s, MaxMemory)
}

// FirstName is the first word of a name, letters only.
func FirstName(name string) string {
	f := strings.Fields(clean(name))
	if len(f) == 0 {
		return ""
	}
	n := strings.TrimFunc(f[0], func(r rune) bool { return !unicode.IsLetter(r) })
	return truncate(n, maxNameRunes)
}

// NewFacts cleans the parent's input. It fails when no memory survives cleaning.
func NewFacts(childName string, ageMonths *int, theme Theme, signedAs string, memories []string) (Facts, error) {
	f := Facts{ChildName: FirstName(childName), AgeMonths: ageMonths, Theme: theme, SignedAs: truncate(clean(signedAs), 24), Memories: []string{}}
	if f.ChildName == "" {
		return Facts{}, errors.New("no child name")
	}
	if f.SignedAs == "" {
		return Facts{}, errors.New("no signedAs")
	}
	for _, m := range memories {
		if c := CleanMemory(m); utf8.RuneCountInString(c) >= 2 && len(f.Memories) < MaxMemories {
			f.Memories = append(f.Memories, c)
		}
	}
	if len(f.Memories) == 0 {
		return Facts{}, ErrNoMemory
	}
	return f, nil
}

// Writer writes stories, with the model when a key is set.
type Writer struct {
	cfg  ai.Config
	http *http.Client
}

func NewWriter(cfg ai.Config) *Writer { return &Writer{cfg: cfg, http: &http.Client{}} }

// Enabled reports whether stories are written by the model.
func (w *Writer) Enabled() bool { return w.cfg.Enabled() }

// Write never fails: any problem with the model gives the template story.
func (w *Writer) Write(ctx context.Context, f Facts) Book {
	if w.cfg.Enabled() {
		if b, err := w.generate(ctx, f); err == nil {
			return b
		}
	}
	return Template(f)
}

const systemPrompt = `You write short picture-book stories for young children, read aloud by a parent at home.
Use only the facts in the user message. Rules:
- 6 to 10 pages. Each page is one to three short sentences, at most 280 characters, in simple words a small child knows, with a gentle rhythm for reading aloud.
- Weave in every memory the parent gave, retold kindly for a child. Do not invent other facts about the family.
- Warm and calm. No fears, dangers, villains, sadness, illness, injuries, doctors, hospitals, medicine or anything medical. No real place names, addresses, brands or dates, no numbers written as digits, no links.
- Call the child by childFirstName. Call the parent who tells the story by signedAs.
- The last page ends with a hug or a loving goodnight.
- For each page choose art from: moon, stars, sunrise, garden, home, hearts, journey, cuddle.
Answer with JSON only, exactly this shape:
{"title": "at most 60 characters", "pages": [{"text": "...", "art": "moon"}]}`

var themeBrief = map[Theme]string{
	Bedtime:   "a calm bedtime story that ends in sleep",
	Adventure: "a small, safe adventure close to home",
	Born:      "the day you were born, told to the child by their parent",
	Sibling:   "a new baby is coming to the family, and the child is loved just the same",
}

func (w *Writer) generate(ctx context.Context, f Facts) (Book, error) {
	facts, err := json.Marshal(struct {
		Facts
		Story string `json:"story"`
	}{f, themeBrief[f.Theme]})
	if err != nil {
		return Book{}, err
	}
	text, err := w.cfg.Text(ctx, w.http, ai.Request{
		Model: Model, System: systemPrompt, MaxTokens: 4000, Effort: "low",
		User: "Facts for the story:\n" + string(facts),
	})
	if err != nil {
		return Book{}, err
	}
	b, err := Parse(text, f)
	if err != nil {
		return Book{}, err
	}
	b.GeneratedBy = "ai"
	return b, nil
}

// unsuitable is what a generated page must never say. The template passes it
// too (see the tests), so a parent never sees these from either writer.
var unsuitable = regexp.MustCompile(`(?i)\b(hospitals?|doctors?|nurses?|medicines?|medical|sick|illness|ill|fever|vaccines?|injur\w*|blood|pain|hurts?|die|died|dies|death|dead|kill\w*|monsters?|scared|afraid|fear\w*|nightmares?|danger\w*|scary)\b|https?://|www\.|@|\d`)

// Unsuitable reports text a children's story from this app must not contain.
func Unsuitable(s string) bool { return unsuitable.MatchString(s) || aiplan.Unsafe(s) }

var artSet = func() map[string]bool {
	m := map[string]bool{}
	for _, a := range Art {
		m[a] = true
	}
	return m
}()

// Parse checks the model's answer. It is strict: a story that breaks a rule is
// rejected whole and the template is used instead.
func Parse(text string, f Facts) (Book, error) {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(strings.TrimPrefix(text, "```json"), "```")
	text = strings.TrimSpace(strings.TrimSuffix(text, "```"))
	var raw struct {
		Title string `json:"title"`
		Pages []Page `json:"pages"`
	}
	dec := json.NewDecoder(strings.NewReader(text))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&raw); err != nil {
		return Book{}, errors.New("answer is not the expected JSON")
	}
	b := Book{Title: clean(raw.Title)}
	if b.Title == "" || utf8.RuneCountInString(b.Title) > MaxTitle {
		return Book{}, errors.New("title out of bounds")
	}
	if len(raw.Pages) < MinPages || len(raw.Pages) > MaxPages {
		return Book{}, fmt.Errorf("%d pages", len(raw.Pages))
	}
	all := []string{b.Title}
	for _, p := range raw.Pages {
		p.Text = clean(p.Text)
		if p.Text == "" || utf8.RuneCountInString(p.Text) > MaxPageText {
			return Book{}, errors.New("page out of bounds")
		}
		if !artSet[p.Art] {
			return Book{}, errors.New("unknown art")
		}
		all = append(all, p.Text)
		b.Pages = append(b.Pages, p)
	}
	joined := strings.Join(all, " ")
	if Unsuitable(joined) {
		return Book{}, errors.New("unsuitable words")
	}
	if !strings.Contains(joined, f.ChildName) {
		return Book{}, errors.New("the child is not in the story")
	}
	return b, nil
}
