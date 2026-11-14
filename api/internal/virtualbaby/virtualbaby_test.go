package virtualbaby

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// Every scenario a plan names exists, every choice is sourced, and every
// moment offers at least one recommended choice.
func TestCatalogueIsSourcedAndComplete(t *testing.T) {
	for _, s := range Scenarios() {
		rec := false
		ids := map[string]bool{}
		for _, c := range s.Choices {
			if ids[c.ID] {
				t.Errorf("%s: duplicate choice %s", s.ID, c.ID)
			}
			ids[c.ID] = true
			f := c.Feedback
			if f.Headline == "" || f.Why == "" || !strings.HasPrefix(f.Source.URL, "https://") || f.Source.CheckedAt.IsZero() {
				t.Errorf("%s/%s: feedback without a source", s.ID, c.ID)
			}
			if strings.Contains(f.Why+f.Headline+c.Label+s.Cue, "!") {
				t.Errorf("%s/%s: no exclamation marks", s.ID, c.ID)
			}
			rec = rec || f.Fit == Recommended
		}
		if !rec || len(s.Choices) < 2 {
			t.Errorf("%s: needs two choices and one recommended", s.ID)
		}
		if _, ok := Every[s.Need]; !ok {
			t.Errorf("%s: unknown need %s", s.ID, s.Need)
		}
	}
	for mode, p := range plans {
		last := -1
		for _, sl := range p.Slots {
			if _, ok := Lookup(sl.Scenario); !ok {
				t.Errorf("%s: unknown scenario %s", mode, sl.Scenario)
			}
			if sl.Minute <= last || sl.Minute >= p.Length {
				t.Errorf("%s: slot at %d out of order or past the end", mode, sl.Minute)
			}
			last = sl.Minute
		}
	}
}

func TestStickersRewardTakingPartNotChoices(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	t0 := time.Date(2026, 11, 1, 20, 0, 0, 0, time.UTC)
	moment := func(seq int, scenario, choice string, who uuid.UUID, plan Plan) Moment {
		sc, _ := Lookup(scenario)
		ch, _ := sc.Choice(choice)
		return Moment{Seq: seq, Minute: plan.Slots[seq].Minute, Scenario: sc, Choice: ch, HandledBy: who, HandledAt: t0.Add(time.Duration(seq) * time.Minute)}
	}
	ev := plans[Evening]
	// Only "another way" answers by one parent: still earns the topic stickers, no tag team.
	s := Session{Mode: Evening, StartedAt: t0, Plan: ev, Moments: []Moment{
		moment(0, "early-cues", "wait-cry", a, ev),
		moment(1, "after-feed", "later", a, ev),
	}}
	got := map[StickerID]bool{}
	for _, st := range Stickers([]Session{s}) {
		got[st.ID] = true
	}
	if !got[FeedingCues] || !got[FreshDiaper] || got[TagTeam] || got[BackToSleep] {
		t.Errorf("one parent, two topics: %v", got)
	}
	// The other parent joins: tag team, earned once.
	s.Moments = append(s.Moments, moment(2, "checked-all", "hold", b, ev))
	n := 0
	for _, st := range Stickers([]Session{s, s}) {
		if st.ID == TagTeam {
			n++
			if len(st.EarnedBy) != 2 {
				t.Errorf("tag team earned by %v", st.EarnedBy)
			}
		}
	}
	if n != 1 {
		t.Errorf("tag team %d times, want once", n)
	}
	// A night moment in the challenge (02:40 on day one) earns the night sticker.
	ch := plans[Challenge]
	night := -1
	for i, sl := range ch.Slots {
		if (ch.StartClock+sl.Minute)%(24*60) < 5*60 {
			night = i
			break
		}
	}
	if night < 0 {
		t.Fatal("the challenge has a night moment")
	}
	c := Session{Mode: Challenge, StartedAt: t0, Plan: ch, Moments: []Moment{moment(night, ch.Slots[night].Scenario, "feed-crib", a, ch)}}
	got = map[StickerID]bool{}
	for _, st := range Stickers([]Session{c}) {
		got[st.ID] = true
	}
	if !got[NightOwl] || got[FortyEight] {
		t.Errorf("night moment: %v", got)
	}
}
