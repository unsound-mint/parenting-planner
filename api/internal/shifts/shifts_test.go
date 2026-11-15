package shifts

import (
	"testing"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func spec(start, end string, days ...string) Spec { return Spec{Days: days, Start: start, End: end} }

func TestOverlap(t *testing.T) {
	cases := []struct {
		name string
		a, b Spec
		want bool
	}{
		{"different days", spec("22:00", "02:00", "mon"), spec("22:00", "02:00", "wed"), false},
		{"same day and hours", spec("09:00", "12:00", "mon"), spec("11:00", "13:00", "mon"), true},
		{"back to back is fine", spec("09:00", "12:00", "mon"), spec("12:00", "15:00", "mon"), false},
		{"night shift runs into tuesday", spec("22:00", "02:00", "mon"), spec("01:00", "03:00", "tue"), true},
		{"tuesday after the night ends", spec("22:00", "02:00", "mon"), spec("02:00", "04:00", "tue"), false},
		{"sunday night wraps to monday", spec("23:00", "03:00", "sun"), spec("02:00", "04:00", "mon"), true},
		{"one of many days overlaps", spec("09:00", "10:00", "mon", "wed", "fri"), spec("09:30", "11:00", "fri", "sat"), true},
		{"two nights the same day", spec("22:00", "02:00", "sat"), spec("23:00", "01:00", "sat"), true},
	}
	for _, c := range cases {
		if got := Overlap(c.a, c.b); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
		if got := Overlap(c.b, c.a); got != c.want {
			t.Errorf("%s (reversed): got %v, want %v", c.name, got, c.want)
		}
	}
}

func d(y int, m time.Month, day, h, min int) time.Time {
	return time.Date(y, m, day, h, min, 0, 0, time.UTC)
}

// ny is a wall-clock time on the family's clock, where shift times live.
func ny(y int, m time.Month, day, h, min int) time.Time {
	return time.Date(y, m, day, h, min, 0, 0, familyZone)
}

func TestOccurrencesAndCurrent(t *testing.T) {
	start := d(2026, 11, 16, 0, 0) // a Monday
	sh := store.Shift{Days: []string{"mon", "thu"}, StartTime: "22:00", EndTime: "02:00", StartsOn: &start}

	got := Occurrences(sh, d(2026, 11, 9, 0, 0), d(2026, 11, 24, 0, 0))
	if len(got) != 3 { // Mon 16, Thu 19, Mon 23; nothing before it starts
		t.Fatalf("occurrences = %+v", got)
	}
	if !got[0].Start.Equal(ny(2026, 11, 16, 22, 0)) || !got[0].End.Equal(ny(2026, 11, 17, 2, 0)) {
		t.Errorf("first = %+v, want Mon 22:00 to Tue 02:00", got[0])
	}
	if n := len(Occurrences(store.Shift{Days: []string{"mon"}, StartTime: "09:00", EndTime: "10:00"}, start, start.AddDate(0, 0, 7))); n != 0 {
		t.Errorf("an agreed shift (no start day) has no occurrences, got %d", n)
	}

	if _, ok := Current(sh, ny(2026, 11, 17, 1, 0)); !ok {
		t.Error("Tuesday 01:00 is inside Monday night's shift")
	}
	if _, ok := Current(sh, ny(2026, 11, 17, 2, 0)); ok {
		t.Error("the end is exclusive")
	}
	if _, ok := Current(sh, ny(2026, 11, 18, 23, 0)); ok {
		t.Error("Wednesday is not a shift day")
	}
}
