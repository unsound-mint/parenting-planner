package paperwork

import (
	"testing"
	"time"
)

func day(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

func TestEveryItemHasASourceAndCheckedDate(t *testing.T) {
	for _, it := range Catalog {
		if it.Source.URL == "" || it.Source.Title == "" || it.Source.CheckedAt.IsZero() {
			t.Errorf("%s has no source", it.Key)
		}
	}
}

func TestDeadlinesMoveWithTheAnchor(t *testing.T) {
	due := day(2027, 2, 20)
	byKey := map[string]Item{}
	for _, it := range Catalog {
		byKey[it.Key] = it
	}
	if got := Deadline(byKey["leave-notice"], due); !got.Equal(day(2027, 1, 21)) {
		t.Errorf("leave notice = %v", got)
	}
	// Moving the due date a week later moves every deadline a week later.
	for _, it := range Catalog {
		if d := Deadline(it, due.AddDate(0, 0, 7)).Sub(Deadline(it, due)); d != 7*24*time.Hour {
			t.Errorf("%s moved by %v", it.Key, d)
		}
	}
	if got := Deadline(byKey["baby-health-insurance"], day(2027, 3, 1)); !got.Equal(day(2027, 4, 30)) {
		t.Errorf("insurance = %v", got)
	}
}

func TestStatusOf(t *testing.T) {
	today := day(2026, 11, 14)
	cases := []struct {
		name     string
		done     bool
		deadline time.Time
		want     Status
	}{
		{"done wins over overdue", true, day(2026, 11, 1), Done},
		{"past", false, day(2026, 11, 13), Overdue},
		{"today is still due", false, today, Due},
		{"14 days away", false, today.AddDate(0, 0, 14), Due},
		{"15 days away", false, today.AddDate(0, 0, 15), Upcoming},
	}
	for _, c := range cases {
		if got := StatusOf(c.done, c.deadline, today); got != c.want {
			t.Errorf("%s: got %s, want %s", c.name, got, c.want)
		}
	}
}

func TestPickAnchor(t *testing.T) {
	b, d := day(2026, 10, 1), day(2027, 1, 1)
	if a, kind, ok := PickAnchor(&b, &d); !ok || kind != BirthDate || !a.Equal(b) {
		t.Errorf("born baby must anchor on the birth date: %v %v %v", a, kind, ok)
	}
	if _, kind, ok := PickAnchor(nil, &d); !ok || kind != DueDate {
		t.Errorf("pregnancy anchors on the due date: %v %v", kind, ok)
	}
	if _, _, ok := PickAnchor(nil, nil); ok {
		t.Error("no anchor without a date")
	}
}
