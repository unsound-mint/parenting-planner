package calendar

import (
	"strings"
	"time"
	"unicode/utf8"
)

const icalDate = "20060102"
const icalTimestamp = "20060102T150405Z"

var icalEscape = strings.NewReplacer("\\", "\\\\", "\r\n", "\\n", "\r", "\\n", "\n", "\\n", ";", "\\;", ",", "\\,")

// EncodeFeed writes RFC 5545 dates, escaped text and CRLF-folded content lines.
func EncodeFeed(events []Event, now time.Time) string {
	var out strings.Builder
	out.WriteString("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Family Nest//Calendar//EN\r\n")
	for _, event := range events {
		if event.Kind == "psychologist_session" {
			continue
		}
		out.WriteString("BEGIN:VEVENT\r\n")
		writeLine(&out, "UID:"+event.ID)
		writeLine(&out, "DTSTAMP:"+now.UTC().Format(icalTimestamp))
		if event.AllDay {
			writeLine(&out, "DTSTART;VALUE=DATE:"+event.StartsAt.UTC().Format(icalDate))
			if event.EndsAt != nil {
				endDate := event.EndsAt.UTC().Format(icalDate)
				if endDate > event.StartsAt.UTC().Format(icalDate) {
					writeLine(&out, "DTEND;VALUE=DATE:"+endDate)
				}
			}
		} else {
			writeLine(&out, "DTSTART:"+event.StartsAt.UTC().Format(icalTimestamp))
			if event.EndsAt != nil && event.EndsAt.After(event.StartsAt) {
				writeLine(&out, "DTEND:"+event.EndsAt.UTC().Format(icalTimestamp))
			}
		}
		writeLine(&out, "SUMMARY:"+icalEscape.Replace(event.Title))
		if event.Location != nil {
			writeLine(&out, "LOCATION:"+icalEscape.Replace(*event.Location))
		}
		out.WriteString("END:VEVENT\r\n")
	}
	out.WriteString("END:VCALENDAR\r\n")
	return out.String()
}

func writeLine(out *strings.Builder, line string) {
	for len(line) > 75 {
		end := 75
		for !utf8.RuneStart(line[end]) {
			end--
		}
		out.WriteString(line[:end])
		out.WriteString("\r\n")
		line = " " + line[end:]
	}
	out.WriteString(line)
	out.WriteString("\r\n")
}
