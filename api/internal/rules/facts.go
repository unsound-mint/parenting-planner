package rules

import "time"

// Facts is everything the rules may look at, already filtered to what the
// viewing parent is allowed to see (see internal/access).
type Facts struct {
	Today   time.Time
	Viewer  Role
	Stage   string
	DueDate *time.Time
	// PregnancyLoss is true while the family is in pregnancy loss support. The
	// stage is planning then, but the preconception nudges must not fire.
	PregnancyLoss bool

	// Lab result kinds on record for the pregnant parent, with the latest date.
	PregnancyLabs map[string]time.Time
	// Vaccines on record per parent, with the latest date.
	Immunizations map[Role]map[string]time.Time
	// Care team roles the family has filled (obgyn, pediatrician, ...).
	CareTeam map[string]bool
	// The viewing parent's own mood check-ins from the last 14 days, newest first.
	RecentMoods []MoodSample
	// The viewing parent's own mood questionnaires from the last year, newest
	// first. Never the other parent's, even when shared.
	MoodScreenings []ScreeningSample
	// When the viewing parent last wrote a note after a psychologist session
	// (last 14 days only), and whether they have a next session booked. Never
	// the note text.
	LastSessionNoteAt *time.Time
	NextSessionBooked bool
	// Rubella immunity from the pregnant or planning parent's latest lab that
	// reports it: "immune", "not immune", or "" when no lab says.
	MotherRubella string
	// MotherRubellaOn is the date of that lab; zero when MotherRubella is empty.
	MotherRubellaOn time.Time
	// The family's children, oldest first.
	Children []ChildFacts
	// The family's childcare options (family-wide, both parents see them).
	ChildcareOptions []ChildcareOptionFacts
}

// ChildcareOptionFacts is what the rules know about one childcare option.
type ChildcareOptionFacts struct {
	Name     string
	Status   string
	DecideBy *time.Time
}

// ChildFacts is what the rules know about one child.
type ChildFacts struct {
	Name      string
	BirthDate time.Time
	// Doses on record per vaccine (dtap, ipv, mmr, ...).
	Doses map[string]int
	// Lab or screening kinds on record (vision_screen, ...), with the latest date.
	Labs map[string]time.Time
}

// AgeMonths is the child's age in completed months on the given day.
func (c ChildFacts) AgeMonths(on time.Time) int {
	m := (on.Year()-c.BirthDate.Year())*12 + int(on.Month()-c.BirthDate.Month())
	if on.Day() < c.BirthDate.Day() {
		m--
	}
	return max(m, 0)
}

const pregnancyDays = 280

// GestationalWeek returns completed weeks of pregnancy, counted from the
// estimated due date (due date minus 280 days). It reports false when there is
// no pregnancy or when today is before the counted start, which only happens
// with a due date more than 280 days away.
func (f Facts) GestationalWeek() (int, bool) {
	if f.Stage != "pregnancy" || f.DueDate == nil {
		return 0, false
	}
	days := calendarDays(f.PregnancyStart(), f.Today)
	if days < 0 {
		return 0, false
	}
	return days / 7, true
}

// calendarDays counts whole calendar days from a to b, ignoring the time of
// day and the zone, so a timestamp late in the day never shifts the week.
func calendarDays(a, b time.Time) int {
	ay, am, ad := a.Date()
	by, bm, bd := b.Date()
	from := time.Date(ay, am, ad, 0, 0, 0, 0, time.UTC)
	to := time.Date(by, bm, bd, 0, 0, 0, 0, time.UTC)
	return int(to.Sub(from).Hours() / 24)
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
