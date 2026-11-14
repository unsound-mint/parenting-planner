package care

import (
	"testing"
	"time"
)

// The brief has no sending worker: its state is read off the clock. These
// cases pin when a parent's brief counts as sent and when it is finished.
func TestBriefState(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	at := func(h int) *time.Time { v := now.Add(time.Duration(h) * time.Hour); return &v }
	cases := []struct {
		name         string
		stored       string
		sendAt       *time.Time
		sentAt       *time.Time
		session      *time.Time
		booked       bool
		wantStatus   string
		wantSent     *time.Time
		wantFinished bool
	}{
		{"draft with a session ahead", BriefDraft, nil, nil, at(48), true, BriefDraft, nil, false},
		{"scheduled before its send time", BriefScheduled, at(2), nil, at(26), true, BriefScheduled, nil, false},
		{"scheduled at its send time is sent", BriefScheduled, at(0), nil, at(24), true, BriefSent, at(0), false},
		{"scheduled past its send time, session ahead", BriefScheduled, at(-3), nil, at(21), true, BriefSent, at(-3), false},
		{"handed over by hand, session ahead", BriefSent, nil, at(-1), at(5), true, BriefSent, at(-1), false},
		{"session started", BriefSent, nil, at(-30), at(-1), true, BriefSent, at(-30), true},
		{"draft whose session passed", BriefDraft, nil, nil, at(-1), true, BriefDraft, nil, true},
		{"sent, then the booking was cancelled", BriefSent, nil, at(-1), nil, false, BriefSent, at(-1), true},
		{"draft with no booking stays", BriefDraft, nil, nil, nil, false, BriefDraft, nil, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			status, sent, finished := briefState(c.stored, c.sendAt, c.sentAt, c.session, c.booked, now)
			if status != c.wantStatus || finished != c.wantFinished || !sameTime(sent, c.wantSent) {
				t.Errorf("got %s %v %v, want %s %v %v", status, sent, finished, c.wantStatus, c.wantSent, c.wantFinished)
			}
		})
	}
}

func sameTime(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == b
	}
	return a.Equal(*b)
}
