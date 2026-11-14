package stage

import (
	"errors"
	"testing"
	"time"
)

func day(y int, m time.Month, d int) *time.Time {
	t := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	return &t
}

func sp(s string) *string { return &s }

func TestApply(t *testing.T) {
	today := *day(2026, 11, 14)
	due := day(2027, 2, 1)
	cases := []struct {
		name     string
		stage    string
		due      *time.Time
		hasChild bool
		in       Update
		wantS    string
		wantDue  *time.Time
		wantErr  error
	}{
		{"move the due date", "pregnancy", due, false, Update{DueDate: day(2027, 2, 15)}, "pregnancy", day(2027, 2, 15), nil},
		{"pregnancy needs a due date", "planning", nil, false, Update{Stage: sp("pregnancy")}, "", nil, ErrDueDateRequired},
		{"pregnancy with a sent due date", "planning", nil, false, Update{Stage: sp("pregnancy"), DueDate: due}, "pregnancy", due, nil},
		{"due date too far", "pregnancy", due, false, Update{DueDate: day(2028, 1, 1)}, "", nil, ErrBadDueDate},
		{"due date long past", "pregnancy", due, false, Update{DueDate: day(2026, 10, 1)}, "", nil, ErrBadDueDate},
		{"leaving pregnancy clears the due date", "pregnancy", due, false, Update{Stage: sp("trying")}, "trying", nil, nil},
		{"after birth needs a child", "pregnancy", due, false, Update{Stage: sp("postpartum")}, "", nil, ErrNoChild},
		{"after birth with a child", "postpartum", due, true, Update{Stage: sp("infant")}, "infant", due, nil},
		{"planning ignores a sent due date", "planning", nil, false, Update{DueDate: due}, "planning", nil, nil},
	}
	for _, c := range cases {
		s, d, err := Apply(c.stage, c.due, c.hasChild, c.in, today)
		if !errors.Is(err, c.wantErr) {
			t.Errorf("%s: err = %v, want %v", c.name, err, c.wantErr)
			continue
		}
		if err == nil && (s != c.wantS || (d == nil) != (c.wantDue == nil) || (d != nil && !d.Equal(*c.wantDue))) {
			t.Errorf("%s: got %s %v, want %s %v", c.name, s, d, c.wantS, c.wantDue)
		}
	}
}
