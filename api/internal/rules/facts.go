package rules

import "time"

// Facts is everything the rules may look at, already filtered to what the
// viewing parent is allowed to see (see internal/access).
type Facts struct {
	Today   time.Time
	Viewer  Role
	Stage   string
	DueDate *time.Time

	// Lab result kinds on record for the pregnant parent, with the latest date.
	PregnancyLabs map[string]time.Time
	// Vaccines on record per parent, with the latest date.
	Immunizations map[Role]map[string]time.Time
	// Care team roles the family has filled (obgyn, pediatrician, ...).
	CareTeam map[string]bool
	// The viewing parent's own mood check-ins from the last 14 days, newest first.
	RecentMoods []MoodSample
}

const pregnancyDays = 280

// GestationalWeek returns completed weeks of pregnancy, counted from the
// estimated due date (due date minus 280 days).
func (f Facts) GestationalWeek() (int, bool) {
	if f.Stage != "pregnancy" || f.DueDate == nil {
		return 0, false
	}
	start := f.DueDate.AddDate(0, 0, -pregnancyDays)
	return int(f.Today.Sub(start).Hours() / 24 / 7), true
}

// DateAtWeek is the last day of the given gestational week.
func (f Facts) DateAtWeek(week int) time.Time {
	start := f.DueDate.AddDate(0, 0, -pregnancyDays)
	return start.AddDate(0, 0, (week+1)*7-1)
}

// PregnancyStart is the first day of the pregnancy as counted clinically.
func (f Facts) PregnancyStart() time.Time { return f.DueDate.AddDate(0, 0, -pregnancyDays) }

func (f Facts) vaccinatedSince(r Role, vaccine string, since time.Time) bool {
	d, ok := f.Immunizations[r][vaccine]
	return ok && !d.Before(since)
}

func (f Facts) everVaccinated(r Role, vaccine string) bool {
	_, ok := f.Immunizations[r][vaccine]
	return ok
}

// MoodSample is one of the viewing parent's own mood check-ins.
type MoodSample struct {
	At   time.Time
	Mood int // 1 = very low, 5 = very good
}
