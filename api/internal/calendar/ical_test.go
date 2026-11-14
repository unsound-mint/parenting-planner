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
		{ID: "private-visit", Kind: "provider_visit", Visibility: "private", Title: "Visit with Hidden Therapy", StartsAt: now},
		{ID: "shared-visit", Kind: "provider_visit", Visibility: "family", Title: "Visit with Named Therapy", StartsAt: now},
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
	if strings.Contains(file, "private-visit") || strings.Contains(file, "Hidden") {
		t.Fatal("private provider visit leaked")
	}
	if !strings.Contains(file, "UID:shared-visit") || strings.Contains(file, "Named Therapy") {
		t.Fatal("shared provider visit should be in the feed with a neutral title")
	}
}
