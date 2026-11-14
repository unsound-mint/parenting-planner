package demo

import (
	"time"
	_ "time/tzdata" // the API image may have no zoneinfo
)

// familyZone is the zone the web formats every time in (web/src/lib/format.ts). Demo families
// live there, so a seeded 10:00 visit must be 10:00 there, not 10:00 UTC (5 AM on screen).
var familyZone = func() *time.Location {
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		return time.FixedZone("EST", -5*60*60)
	}
	return loc
}()

// atHour is the given hour on day's calendar date, on the family's clock. day is a UTC
// midnight like the seed's today; only its date is used.
func atHour(day time.Time, hour int) time.Time {
	return time.Date(day.Year(), day.Month(), day.Day(), hour, 0, 0, 0, familyZone)
}
