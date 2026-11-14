package rules

import (
	"testing"
	"time"
)

func TestChildcareDecision(t *testing.T) {
	in := func(days int) *time.Time { d := today.AddDate(0, 0, days); return &d }
	cases := []struct {
		name    string
		viewer  Role
		options []ChildcareOptionFacts
		want    Status
	}{
		{"no options", Mother, nil, ""},
		{"waitlisted with a date", Mother, []ChildcareOptionFacts{{Name: "Brightwater", Status: "waitlisted", DecideBy: in(3)}}, ""},
		{"offered without a date", Mother, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "offered"}}, ""},
		{"offered, far off", Mother, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "offered", DecideBy: in(45)}}, ""},
		{"offered, in 10 days", Mother, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "offered", DecideBy: in(10)}}, Upcoming},
		{"offered, in 5 days", Mother, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "offered", DecideBy: in(5)}}, Due},
		{"offered, today", Mother, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "offered", DecideBy: in(0)}}, Due},
		{"offered, date passed", Mother, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "offered", DecideBy: in(-2)}}, Overdue},
		{"accepted", Mother, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "accepted", DecideBy: in(5)}}, ""},
		{"declined", Mother, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "declined", DecideBy: in(5)}}, ""},
		{"the other parent too", Partner, []ChildcareOptionFacts{{Name: "Little Harbor", Status: "offered", DecideBy: in(5)}}, Due},
	}
	for _, c := range cases {
		f := factsAt("postpartum", c.viewer)
		f.ChildcareOptions = c.options
		it := checkStatus(t, c.name, "childcare-decision", f, c.want)
		if it != nil && (it.DueBy == nil || !it.DueBy.Equal(*c.options[0].DecideBy) || it.Category != Logistics) {
			t.Errorf("%s: item %+v, want due by the offer's date, logistics", c.name, it)
		}
	}

	// Two offers: the earlier date wins and the reason counts the other one.
	f := factsAt("postpartum", Mother)
	f.ChildcareOptions = []ChildcareOptionFacts{
		{Name: "Brightwater", Status: "offered", DecideBy: in(20)},
		{Name: "Little Harbor", Status: "offered", DecideBy: in(4)},
	}
	it := checkStatus(t, "two offers", "childcare-decision", f, Due)
	want := "Little Harbor offered you a place and asked for an answer by " + in(4).Format("Jan 2") + ". Another offer is waiting for an answer too."
	if it != nil && it.Reason != want {
		t.Errorf("reason = %q, want %q", it.Reason, want)
	}
}
