// Package aiplan writes a parent's weekly note with the Claude API from the
// data that parent may see, and falls back to the rule plan on any failure.
//
// What goes into the prompt: the stage, the week, the parent's own due plan
// items (fixed, sourced text) and their own last week of mood, energy and sleep
// as numbers. Never free text (notes, diary, session notes), never the other
// parent's records. What comes back is checked before it is used: it must be
// the expected JSON, every point that cites a rule must cite one the parent has
// (its source is attached from the rule, not from the model), and text that
// diagnoses or mentions self-harm is rejected, because those go to the fixed
// urgent-help screens, never to generated text.
package aiplan

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/ai"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
)

// DefaultModel is used when ANTHROPIC_MODEL is not set.
const DefaultModel = "claude-sonnet-5-5"

const (
	anthropicURL     = "https://api.anthropic.com"
	anthropicVersion = "2023-06-01"
	defaultTimeout   = 12 * time.Second
	maxResponseBytes = 1 << 20

	maxIntro    = 400
	maxSections = 4
	maxPoints   = 5
	maxText     = 300
	maxReason   = 200
)

// Mood is one of the parent's own check-ins, as numbers only.
type Mood struct {
	Date       string  `json:"date"`
	Mood       int     `json:"mood"`
	Energy     int     `json:"energy"`
	SleepHours float64 `json:"sleepHours"`
}

// Facts is everything the model is told.
type Facts struct {
	Role            string       `json:"role"`
	Stage           string       `json:"stage"`
	GestationalWeek *int         `json:"gestationalWeek,omitempty"`
	PlanItems       []Item       `json:"planItems"`
	RecentMood      []Mood       `json:"recentMood"`
	items           []rules.Item // the rule items behind PlanItems, for sources
}

// Item is a rule plan item as the model sees it.
type Item struct {
	RuleID string `json:"ruleId"`
	Title  string `json:"title"`
	Status string `json:"status"`
	Reason string `json:"reason"`
	DueBy  string `json:"dueBy,omitempty"`
}

// NewFacts builds the model's input. Only the parent's own items and moods go in.
func NewFacts(role, stage string, week *int, items []rules.Item, moods []Mood) Facts {
	f := Facts{Role: role, Stage: stage, GestationalWeek: week, PlanItems: []Item{}, RecentMood: moods, items: items}
	if f.RecentMood == nil {
		f.RecentMood = []Mood{}
	}
	for _, it := range items {
		i := Item{RuleID: it.RuleID, Title: it.Title, Status: string(it.Status), Reason: it.Reason}
		if it.DueBy != nil {
			i.DueBy = it.DueBy.Format("2006-01-02")
		}
		f.PlanItems = append(f.PlanItems, i)
	}
	return f
}

type Point struct {
	Text   string
	Reason string
	RuleID string
	Source *rules.Source
}

type Section struct {
	Title  string
	Points []Point
}

type Plan struct {
	Intro    string
	Sections []Section
	// Fallback is true when the rule plan was used instead of the model.
	Fallback bool
}

// Client calls the Claude API. With no key it is off and every call falls back.
type Client struct {
	cfg  ai.Config
	http *http.Client
}

func New(cfg ai.Config) *Client { return &Client{cfg: cfg, http: &http.Client{}} }

const systemPrompt = `You write a short, warm weekly note for one parent in a family health planner.
Use only the facts in the user message. Rules you must follow:
- Never diagnose, never name a medical or mental health condition the parent might have, never give treatment advice.
- Every point about health must be one of the parent's planItems: set "ruleId" to that item's ruleId and say it in your own plain words. Do not invent items.
- Points about mood, energy or sleep must say what the numbers show ("you slept about 5.5 hours on average") and may suggest talking to the care team or the partner; never judge.
- Do not mention urgent symptoms, emergencies, self-harm or crisis: another screen handles those.
- Plain words, at most two sentences per point, no emoji.
Answer with JSON only, in exactly this shape:
{"intro": "one or two warm sentences", "sections": [{"title": "For you", "points": [{"text": "...", "reason": "the data behind it", "ruleId": "optional rule id"}]}]}`

type request struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system"`
	Messages  []message `json:"messages"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type response struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// Generate asks the model for the note and validates it. Any error means the
// caller should use the fallback.
func (c *Client) Generate(ctx context.Context, f Facts) (Plan, error) {
	if !c.cfg.Enabled() {
		return Plan{}, errors.New("ai is off")
	}
	timeout := c.cfg.Timeout
	if timeout == 0 {
		timeout = defaultTimeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	model := c.cfg.Model
	if model == "" {
		model = DefaultModel
	}
	facts, err := json.Marshal(f)
	if err != nil {
		return Plan{}, err
	}
	body, err := json.Marshal(request{
		Model: model, MaxTokens: 900, System: systemPrompt,
		Messages: []message{{Role: "user", Content: "Facts about this parent's week:\n" + string(facts)}},
	})
	if err != nil {
		return Plan{}, err
	}
	base := c.cfg.BaseURL
	if base == "" {
		base = anthropicURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return Plan{}, err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("anthropic-version", anthropicVersion)
	req.Header.Set("x-api-key", c.cfg.APIKey.Reveal())
	res, err := c.http.Do(req)
	if err != nil {
		return Plan{}, fmt.Errorf("claude request failed")
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, maxResponseBytes))
	if err != nil || res.StatusCode != http.StatusOK {
		return Plan{}, fmt.Errorf("claude answered %d", res.StatusCode)
	}
	var out response
	if err := json.Unmarshal(raw, &out); err != nil {
		return Plan{}, err
	}
	for _, block := range out.Content {
		if block.Type == "text" {
			return Parse(block.Text, f)
		}
	}
	return Plan{}, errors.New("no text in the answer")
}

type modelPlan struct {
	Intro    string `json:"intro"`
	Sections []struct {
		Title  string `json:"title"`
		Points []struct {
			Text   string `json:"text"`
			Reason string `json:"reason"`
			RuleID string `json:"ruleId"`
		} `json:"points"`
	} `json:"sections"`
}

// Parse checks the model's text and turns it into a plan. It is strict: a
// plan that breaks a rule is rejected whole, so a bad answer never reaches the
// parent.
func Parse(text string, f Facts) (Plan, error) {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(strings.TrimPrefix(text, "```json"), "```")
	text = strings.TrimSpace(strings.TrimSuffix(text, "```"))
	var mp modelPlan
	dec := json.NewDecoder(strings.NewReader(text))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&mp); err != nil {
		return Plan{}, errors.New("answer is not the expected JSON")
	}
	sources := map[string]rules.Source{}
	for _, it := range f.items {
		sources[it.RuleID] = it.Source
	}
	if mp.Intro == "" || len(mp.Intro) > maxIntro || len(mp.Sections) == 0 || len(mp.Sections) > maxSections {
		return Plan{}, errors.New("intro or sections out of bounds")
	}
	plan := Plan{Intro: mp.Intro}
	all := []string{mp.Intro}
	for _, s := range mp.Sections {
		if s.Title == "" || len(s.Points) == 0 || len(s.Points) > maxPoints {
			return Plan{}, errors.New("section out of bounds")
		}
		sec := Section{Title: s.Title}
		all = append(all, s.Title)
		for _, p := range s.Points {
			if p.Text == "" || len(p.Text) > maxText || p.Reason == "" || len(p.Reason) > maxReason {
				return Plan{}, errors.New("point out of bounds")
			}
			pt := Point{Text: p.Text, Reason: p.Reason}
			if p.RuleID != "" {
				src, ok := sources[p.RuleID]
				if !ok {
					return Plan{}, errors.New("point cites a rule the parent does not have")
				}
				pt.RuleID = p.RuleID
				pt.Source = &src // the rule's own source, never the model's
			}
			all = append(all, p.Text, p.Reason)
			sec.Points = append(sec.Points, pt)
		}
		plan.Sections = append(plan.Sections, sec)
	}
	if Unsafe(strings.Join(all, " ")) {
		return Plan{}, errors.New("answer diagnoses or mentions an urgent topic")
	}
	return plan, nil
}

var unsafe = regexp.MustCompile(`(?i)diagnos|you (have|are|may have|might have|probably have|seem to have) (clinical )?(depress|anxi|ppd|postpartum depress|a disorder|bipolar|psychosis|preeclampsia|gestational diabetes)|you are (depressed|anxious|suffering)|you suffer|suicid|self[- ]harm|harm (yourself|the baby)|kill (yourself|myself)|end (your|my) life|overdose|emergency|call 911|988`)

// Unsafe reports text that diagnoses or touches an urgent topic. Those never
// come from generated text: the fixed urgent-help screen handles them.
func Unsafe(text string) bool { return unsafe.MatchString(text) }

// Fallback builds the note from the rule plan alone: fixed, sourced text.
func Fallback(f Facts) Plan {
	p := Plan{Intro: "Here is what your plan asks of you this week.", Fallback: true, Sections: []Section{}}
	var points []Point
	for _, it := range f.items {
		if len(points) == maxPoints {
			break
		}
		src := it.Source
		points = append(points, Point{Text: it.Title + ".", Reason: it.Reason, RuleID: it.RuleID, Source: &src})
	}
	if len(points) > 0 {
		p.Sections = append(p.Sections, Section{Title: "This week", Points: points})
	}
	return p
}
