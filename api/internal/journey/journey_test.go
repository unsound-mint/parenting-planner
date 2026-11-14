package journey

import (
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func TestPlace(t *testing.T) {
	today := time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)
	bornAgo := func(y, m, d int) *store.Child {
		return &store.Child{BirthDate: today.AddDate(-y, -m, -d)}
	}
	due := today.AddDate(0, 0, 100)
	for _, tc := range []struct {
		name     string
		stage    string
		due      *time.Time
		youngest *store.Child
		want     Stage
	}{
		{"trying counts as planning", "trying", nil, nil, Planning},
		{"pregnant with an older child stays in pregnancy", "pregnancy", &due, bornAgo(3, 0, 0), Pregnancy},
		{"born today", "postpartum", nil, bornAgo(0, 0, 0), Birth},
		{"one day old", "postpartum", nil, bornAgo(0, 0, 1), Newborn},
		{"day before 3 months", "postpartum", nil, bornAgo(0, 3, -1), Newborn},
		{"3 months", "infant", nil, bornAgo(0, 3, 0), FirstYear},
		{"first birthday", "infant", nil, bornAgo(1, 0, 0), Toddler},
		{"third birthday", "toddler", nil, bornAgo(3, 0, 0), Preschool},
		{"fifth birthday", "preschool", nil, bornAgo(5, 0, 0), SchoolAge},
		{"older than 9 stays at the end", "school_age", nil, bornAgo(10, 0, 0), SchoolAge},
		{"after birth with no child on record", "infant", nil, nil, FirstYear},
	} {
		t.Run(tc.name, func(t *testing.T) {
			j := Place(tc.stage, tc.due, tc.youngest, today)
			if j.Current.Stage != tc.want {
				t.Fatalf("stage = %s, want %s", j.Current.Stage, tc.want)
			}
			current := 0
			for _, s := range j.Stages {
				if s.Status == Current {
					current++
				}
			}
			if len(j.Stages) != len(Stages) || current != 1 {
				t.Errorf("want %d stages with one current, got %+v", len(Stages), j.Stages)
			}
		})
	}
}

// Stage dates touch: each stage starts the day after the previous one ends.
func TestStageDatesAreContiguous(t *testing.T) {
	due := time.Date(2027, 3, 1, 0, 0, 0, 0, time.UTC)
	j := Place("pregnancy", &due, nil, due.AddDate(0, 0, -100))
	for i := 2; i < len(j.Stages); i++ {
		prev, cur := j.Stages[i-1], j.Stages[i]
		if !cur.Starts.Equal(prev.Ends.AddDate(0, 0, 1)) {
			t.Errorf("%s ends %s but %s starts %s", prev.Stage, prev.Ends, cur.Stage, cur.Starts)
		}
	}
}
