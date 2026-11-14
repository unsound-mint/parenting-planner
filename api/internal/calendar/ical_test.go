package calendar

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func TestEncodeFeed(t *testing.T) {
	now := time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)
	title := strings.Repeat("á", 60) + "\nSUMMARY:Injected"
	file := EncodeFeed([]Event{
		{ID: "stable", Title: title, StartsAt: now, AllDay: true},
		{ID: "excluded", Kind: "psychologist_session", StartsAt: now},
	}, now)
	for _, line := range strings.Split(file, "\r\n") {
		if len(line) > 75 || !utf8.ValidString(line) {
			t.Fatalf("invalid folded content line: %q", line)
		}
	}
	unfolded := strings.ReplaceAll(file, "\r\n ", "")
	for _, value := range []string{"UID:stable\r\n", "DTSTART;VALUE=DATE:20261114\r\n", "SUMMARY:" + strings.Repeat("á", 60) + "\\nSUMMARY:Injected\r\n"} {
		if !strings.Contains(unfolded, value) {
			t.Errorf("missing %q", value)
		}
	}
	if strings.Contains(file, "excluded") {
		t.Fatal("psychologist session leaked")
	}
}
