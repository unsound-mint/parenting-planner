// Package story writes "Our story so far": a memory book built only from rows
// the family already has and from the sourced content for weeks and ages it
// has already passed. Nothing is stored for it and nothing is invented.
//
// Load reads the rows (one transaction, with an audit row when shared journal
// lines are read); Build is the pure part that turns them into chapters, so
// most of the rules are tested without a database.
package story

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Chapter kinds, matching StoryChapterKind in openapi.yaml.
const (
	GettingReady = "getting_ready"
	Trimester1   = "trimester_1"
	Trimester2   = "trimester_2"
	Trimester3   = "trimester_3"
	Newborn      = "newborn"
	FirstYear    = "first_year"
	Toddler      = "toddler"
	Preschool    = "preschool"
	SchoolAge    = "school_age"
)

// Moment kinds, matching StoryMomentKind in openapi.yaml.
const (
	PregnancyWeek = "pregnancy_week"
	Appointment   = "appointment"
	Journal       = "journal"
	BabyHome      = "baby_home"
	CareLog       = "care_log"
	Handoff       = "handoff"
	Vaccines      = "vaccines"
	StageLine     = "stage_line"
	LessonRead    = "lesson_read"
	QuizCompared  = "quiz_compared"
	NamesLiked    = "names_liked"
	CoupleTalk    = "couple_talk"
)

// QuoteLimit caps a shared journal line in the book.
const QuoteLimit = 280

type Moment struct {
	ID         string
	Kind       string
	On         time.Time
	Title      string
	Detail     string
	Quote      string
	First      bool
	People     []uuid.UUID
	Week       int
	Comparison string
	Count      int
	Sources    []content.Source
}

type Chapter struct {
	Kind       string
	Title      string
	Span       string
	StartsOn   time.Time
	EndsOn     *time.Time
	Current    bool
	Stage      string
	Comparison string
	Moments    []Moment
}

type Invitation struct {
	Kind  string
	Title string
	On    *time.Time
}

type Story struct {
	Chapters []Chapter
	Next     []Invitation
}

// Person is someone in the family who can appear in the book.
type Person struct {
	ID   uuid.UUID
	Role string
	Name string
}

// Viewer is the acting person and what they were granted.
type Viewer struct {
	ID          uuid.UUID
	Role        string
	Permissions []string
}

func (v Viewer) parent() bool { return v.Role == "mother" || v.Role == "partner" }

func (v Viewer) has(p string) bool { return v.parent() || slices.Contains(v.Permissions, p) }

// mayReadPregnancy is content.Viewer.MayReadPregnancy: parents, and a
// grandparent with pregnancy_updates. A nanny never.
func (v Viewer) mayReadPregnancy() bool {
	return content.Viewer{Role: v.Role, PregnancyUpdates: slices.Contains(v.Permissions, "pregnancy_updates")}.MayReadPregnancy()
}

type JournalLine struct {
	ID      uuid.UUID
	Author  uuid.UUID
	At      time.Time
	Body    string
	IsFirst bool
}

type Visit struct {
	ID        uuid.UUID
	Owner     uuid.UUID
	Title     string
	At        time.Time
	Attendees []uuid.UUID
}

type CareAuthor struct {
	ID      uuid.UUID
	Entries int
	FirstAt time.Time
}

type HandoffRow struct {
	From, To uuid.UUID
	At       time.Time
}

type VaccineDay struct {
	On       time.Time
	Vaccines []string
}

// Input is everything Build reads. Load fills it for one viewer; rows a
// viewer may not see are never loaded, and Build drops kinds a viewer may
// not see as a second guard.
type Input struct {
	Today    time.Time
	Viewer   Viewer
	Stage    string
	DueDate  *time.Time
	Child    *store.Child // the youngest, as in the stage hero
	People   []Person
	Journal  []JournalLine
	Visits   []Visit
	Care     []CareAuthor
	Handoffs []HandoffRow
	Vaccines []VaccineDay
	// Learning together, parents only.
	Reads   []store.LessonRead
	Answers []store.QuizAnswer
	Talks   []store.CoupleTalk
	Names   []store.ListBabyNamesRow
}

const pregnancyDays = 280

// Load reads the family's rows for the viewer and builds the story. key opens
// shared journal lines; reading them is audited like the diary list.
func Load(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID uuid.UUID, viewer Viewer, now, today time.Time) (Story, error) {
	in := Input{Today: today, Viewer: viewer}
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		fam, err := q.GetFamily(ctx, familyID)
		if err != nil {
			return err
		}
		in.Stage, in.DueDate = fam.Stage, fam.DueDate
		kids, err := q.ListChildren(ctx, familyID)
		if err != nil {
			return err
		}
		if n := len(kids); n > 0 && !kids[n-1].BirthDate.After(today) {
			in.Child = &kids[n-1]
		}
		parents, err := q.ListMembers(ctx, familyID)
		if err != nil {
			return err
		}
		carers, err := q.ListCaregivers(ctx, familyID)
		if err != nil {
			return err
		}
		for _, m := range append(parents, carers...) {
			in.People = append(in.People, Person{ID: m.ID, Role: m.Role, Name: m.DisplayName})
		}

		if viewer.has("care_log") && in.Child != nil {
			care, err := q.StoryCareLogByAuthor(ctx, store.StoryCareLogByAuthorParams{FamilyID: familyID, Now: now})
			if err != nil {
				return err
			}
			for _, c := range care {
				in.Care = append(in.Care, CareAuthor{ID: c.AuthorMemberID, Entries: int(c.Entries), FirstAt: c.FirstAt})
			}
			hs, err := q.ListStoryHandoffs(ctx, store.ListStoryHandoffsParams{FamilyID: familyID, Now: now})
			if err != nil {
				return err
			}
			for _, h := range hs {
				// A caregiver's edition holds only the handoffs they took part in.
				if viewer.parent() || h.FromMemberID == viewer.ID || h.ToMemberID == viewer.ID {
					in.Handoffs = append(in.Handoffs, HandoffRow{From: h.FromMemberID, To: h.ToMemberID, At: h.AcceptedAt})
				}
			}
		}
		if !viewer.parent() {
			// Journal lines, visits and vaccines are the parents' book only.
			return nil
		}

		visits, err := q.ListStoryAppointmentsVisibleToParent(ctx, store.ListStoryAppointmentsVisibleToParentParams{FamilyID: familyID, Now: now})
		if err != nil {
			return err
		}
		for _, v := range visits {
			in.Visits = append(in.Visits, Visit{ID: v.ID, Owner: v.OwnerMemberID, Title: v.Title, At: v.StartsAt, Attendees: v.AttendeeIds})
		}
		if in.Child != nil {
			days, err := q.ListStoryChildVaccineDays(ctx, store.ListStoryChildVaccineDaysParams{FamilyID: familyID, Today: today})
			if err != nil {
				return err
			}
			for _, d := range days {
				if d.ChildID == in.Child.ID {
					in.Vaccines = append(in.Vaccines, VaccineDay{On: d.GivenOn, Vaccines: d.Vaccines})
				}
			}
		}
		// Reading, quizzes, talks and names are shared between the parents by
		// design (no visibility, see internal/learn); a caregiver gets 404 there.
		if in.Reads, err = q.ListLessonReads(ctx, familyID); err != nil {
			return err
		}
		if in.Answers, err = q.ListQuizAnswers(ctx, familyID); err != nil {
			return err
		}
		if in.Talks, err = q.ListCoupleTalks(ctx, familyID); err != nil {
			return err
		}
		if in.Names, err = q.ListBabyNames(ctx, familyID); err != nil {
			return err
		}
		rows, err := q.ListStoryDiaryEntriesVisibleToParent(ctx, store.ListStoryDiaryEntriesVisibleToParentParams{FamilyID: familyID, Now: now})
		if err != nil {
			return err
		}
		for _, r := range rows {
			body, err := key.Open(r.BodySealed)
			if errors.Is(err, crypt.ErrCannotDecrypt) {
				continue // sealed with an earlier key, as in diary.List
			}
			if err != nil {
				return err
			}
			in.Journal = append(in.Journal, JournalLine{ID: r.ID, Author: r.OwnerMemberID, At: r.WrittenAt, Body: body})
		}
		return access.Audit(ctx, q, familyID, viewer.ID, access.ActionRead, "diary_entry", "")
	})
	if err != nil {
		return Story{}, err
	}
	return Build(in), nil
}

func day(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// span is one chapter's range [from, to); to is zero for the open last one.
type span struct {
	kind     string
	from, to time.Time
}

// Build turns the rows into chapters. It is pure.
func Build(in Input) Story {
	today := day(in.Today)
	b := builder{in: in, today: today, names: map[uuid.UUID]string{}}
	for _, p := range in.People {
		b.names[p.ID] = p.Name
	}
	b.childName = "Your baby"
	if in.Child != nil {
		b.childName = in.Child.Name
		b.birth = day(in.Child.BirthDate)
	}

	b.pregnancy()
	b.childhood()
	b.rows()

	spans := b.spans()
	var out Story
	for i, s := range spans {
		ch := b.chapter(s, i == len(spans)-1)
		for _, m := range b.moments {
			if b.chapterFor(spans, m.On) == i {
				ch.Moments = append(ch.Moments, m)
			}
		}
		slices.SortStableFunc(ch.Moments, func(a, b Moment) int { return a.On.Compare(b.On) })
		out.Chapters = append(out.Chapters, ch)
	}
	out.Next = b.invitations()
	return out
}

type builder struct {
	in        Input
	today     time.Time
	names     map[uuid.UUID]string
	childName string
	birth     time.Time // zero before birth
	moments   []Moment
	// Set by pregnancy() when the family has a due date the viewer may see.
	start    time.Time // pregnancy week 0
	lastWeek int       // the last pregnancy week reached (today, or the birth)
	pregnant bool
}

func (b *builder) add(m Moment) {
	if m.On.After(b.today) {
		return
	}
	if m.People == nil {
		m.People = []uuid.UUID{}
	}
	b.moments = append(b.moments, m)
}

func (b *builder) name(id uuid.UUID) string {
	if n, ok := b.names[id]; ok {
		return n
	}
	return "Someone"
}

// keyWeeks are the pregnancy weeks that get a page: one a month, plus the halfway mark.
var keyWeeks = []int{8, 12, 16, 20, 24, 28, 32, 36, 40}

func weekTitle(week int, comparison string) string {
	switch week {
	case 12:
		return fmt.Sprintf("End of the first trimester, about the size of %s", comparison)
	case 20:
		return fmt.Sprintf("Halfway there, about the size of %s", comparison)
	case 28:
		return fmt.Sprintf("The third trimester, about the size of %s", comparison)
	}
	return fmt.Sprintf("About the size of %s", comparison)
}

func (b *builder) pregnancyHasStarted() bool { return b.in.DueDate != nil }

func (b *builder) pregnancyWeek(w int) time.Time { return b.start.AddDate(0, 0, 7*w) }

// pregnancy adds the key weeks the family has passed, each with its sourced
// size. Without a due date (a family that started after the birth) the book
// starts at the birth: weeks are never guessed from a birth date.
func (b *builder) pregnancy() {
	if !b.pregnancyHasStarted() || !b.in.Viewer.mayReadPregnancy() {
		return
	}
	b.pregnant = true
	b.start = day(*b.in.DueDate).AddDate(0, 0, -pregnancyDays)
	end := b.today
	if !b.birth.IsZero() {
		end = b.birth.AddDate(0, 0, -1)
	}
	b.lastWeek = min(max(int(end.Sub(b.start).Hours()/24)/7, 0), 42)
	for _, w := range keyWeeks {
		if w > b.lastWeek {
			break
		}
		size, _, ok := content.SizeFor(w)
		if !ok {
			continue
		}
		b.add(Moment{
			ID: fmt.Sprintf("week-%d", w), Kind: PregnancyWeek, On: b.pregnancyWeek(w),
			Title: weekTitle(w, size.Comparison), Week: w, Comparison: size.Comparison, Sources: size.Sources,
		})
	}
}

// Ages that get a stage line in the book: a few weeks of life, then the
// milestone checkpoints. Each is "most babies by", never what this child did.
var lineWeeks = []int{1, 3, 6, 9, 12}
var lineMonths = []int{4, 6, 9, 12, 15, 18, 24, 30, 36, 42, 48, 54, 60, 72, 84, 96, 108}

// childhood adds the arrival and the sourced age lines passed.
func (b *builder) childhood() {
	if b.birth.IsZero() {
		return
	}
	b.add(Moment{ID: "baby-home", Kind: BabyHome, On: b.birth, Title: fmt.Sprintf("%s arrived", b.childName), Detail: "The first day of a new chapter.", People: b.parents()})
	seen := map[string]bool{}
	line := func(id string, at time.Time) {
		if at.After(b.today) {
			return
		}
		l := content.NowForChild(b.birth, at)
		if seen[l.Headline] {
			return
		}
		seen[l.Headline] = true
		b.add(Moment{ID: id, Kind: StageLine, On: at, Title: strings.TrimSuffix(l.Headline, "."), Sources: l.Sources})
	}
	for _, w := range lineWeeks {
		line(fmt.Sprintf("age-week-%d", w), b.birth.AddDate(0, 0, 7*(w-1)))
	}
	for _, m := range lineMonths {
		line(fmt.Sprintf("age-month-%d", m), b.birth.AddDate(0, m, 0))
	}
}

var vaccineNames = map[string]string{
	"hepb": "hepatitis B", "dtap": "DTaP", "ipv": "polio", "hib": "Hib", "pcv": "pneumococcal",
	"rotavirus": "rotavirus", "mmr": "MMR", "varicella": "chickenpox", "flu": "flu", "tdap": "Tdap", "hepa": "hepatitis A",
}

func vaccineName(v string) string {
	if n, ok := vaccineNames[v]; ok {
		return n
	}
	return v
}

func listNames(xs []string) string {
	switch len(xs) {
	case 0:
		return ""
	case 1:
		return xs[0]
	case 2:
		return xs[0] + " and " + xs[1]
	}
	return strings.Join(xs[:len(xs)-1], ", ") + " and " + xs[len(xs)-1]
}

func quote(s string) string {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) <= QuoteLimit {
		return s
	}
	r := []rune(s)[:QuoteLimit-1]
	return strings.TrimRight(string(r), " ,.;") + "…"
}

// rows adds the family's own moments.
func (b *builder) rows() {
	parent := b.in.Viewer.parent()
	if parent {
		for _, v := range b.in.Visits {
			people := []uuid.UUID{v.Owner}
			for _, a := range v.Attendees {
				if !slices.Contains(people, a) {
					people = append(people, a)
				}
			}
			detail := ""
			if len(people) > 1 {
				detail = "You went together."
			}
			b.add(Moment{ID: "visit-" + v.ID.String(), Kind: Appointment, On: day(v.At), Title: v.Title, Detail: detail, People: people})
		}
		for _, j := range b.in.Journal {
			title := fmt.Sprintf("%s shared a page from the journal", b.name(j.Author))
			if j.IsFirst {
				title = fmt.Sprintf("A first, written down by %s", b.name(j.Author))
			}
			b.add(Moment{ID: "journal-" + j.ID.String(), Kind: Journal, On: day(j.At), Title: title, Quote: quote(j.Body), First: j.IsFirst, People: []uuid.UUID{j.Author}})
		}
		for i, d := range b.in.Vaccines {
			names := make([]string, 0, len(d.Vaccines))
			for _, v := range d.Vaccines {
				if n := vaccineName(v); !slices.Contains(names, n) {
					names = append(names, n)
				}
			}
			title := fmt.Sprintf("Vaccines done: %s", listNames(names))
			if i == 0 {
				title = fmt.Sprintf("%s's first vaccine: %s", b.childName, listNames(names))
			}
			b.add(Moment{ID: "vaccines-" + d.On.Format(time.DateOnly), Kind: Vaccines, On: day(d.On), Title: title, Count: len(d.Vaccines)})
		}
	}
	if parent {
		b.learning()
	}
	if len(b.in.Care) > 0 {
		total, first := 0, b.in.Care[0].FirstAt
		people := []uuid.UUID{}
		ranked := slices.Clone(b.in.Care)
		slices.SortStableFunc(ranked, func(a, b CareAuthor) int { return b.Entries - a.Entries })
		for _, c := range ranked {
			total += c.Entries
			if c.FirstAt.Before(first) {
				first = c.FirstAt
			}
			people = append(people, c.ID)
		}
		detail := fmt.Sprintf("%d feeds, naps and changes logged so far", total)
		if len(people) > 1 {
			detail = fmt.Sprintf("%d feeds, naps and changes logged so far, by %d of you", total, len(people))
		}
		b.add(Moment{ID: "care-log", Kind: CareLog, On: day(first), Title: fmt.Sprintf("The first page of %s's care log", b.childName), Detail: detail, People: people, Count: total})
	}
	type pair struct{ from, to uuid.UUID }
	firsts, counts := map[pair]time.Time{}, map[pair]int{}
	var order []pair
	for _, h := range b.in.Handoffs {
		k := pair{h.From, h.To}
		if _, ok := firsts[k]; !ok {
			firsts[k] = h.At
			order = append(order, k)
		}
		counts[k]++
	}
	for _, k := range order {
		detail := ""
		if n := counts[k]; n > 1 {
			detail = fmt.Sprintf("%d handoffs so far", n)
		}
		b.add(Moment{
			ID: "handoff-" + k.from.String() + "-" + k.to.String(), Kind: Handoff, On: day(firsts[k]),
			Title: fmt.Sprintf("%s handed %s over to %s", b.name(k.from), b.childName, b.name(k.to)), Detail: detail,
			People: []uuid.UUID{k.from, k.to}, Count: counts[k],
		})
	}
}

// spans lists the chapters the family has reached, oldest first.
func (b *builder) spans() []span {
	var out []span
	if b.pregnant {
		end := b.birth
		bounds := []struct {
			kind     string
			from, to int
		}{{Trimester1, 0, 14}, {Trimester2, 14, 28}, {Trimester3, 28, 43}}
		for _, t := range bounds {
			from := b.pregnancyWeek(t.from)
			if t.from > 0 && t.from > b.lastWeek {
				break
			}
			to := b.pregnancyWeek(t.to)
			if !end.IsZero() && end.Before(to) {
				to = end
			}
			out = append(out, span{kind: t.kind, from: from, to: to})
			if !end.IsZero() && !to.Before(end) {
				break
			}
		}
		if b.birth.IsZero() {
			out[len(out)-1].to = time.Time{}
		}
	}
	if !b.birth.IsZero() {
		ages := []struct {
			kind   string
			from   time.Time
			months int
		}{
			{Newborn, b.birth, 0},
			{FirstYear, b.birth.AddDate(0, 0, 7*content.WeeksOfLife), 3},
			{Toddler, b.birth.AddDate(0, 12, 0), 12},
			{Preschool, b.birth.AddDate(0, 36, 0), 36},
			{SchoolAge, b.birth.AddDate(0, 60, 0), 60},
		}
		for i, a := range ages {
			if a.from.After(b.today) {
				break
			}
			s := span{kind: a.kind, from: a.from}
			if i+1 < len(ages) && !ages[i+1].from.After(b.today) {
				s.to = ages[i+1].from
			}
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		// Planning, trying, or a stage without a due date or a child the
		// viewer may see: one chapter from the earliest moment to now.
		from := b.today
		for _, m := range b.moments {
			if m.On.Before(from) {
				from = m.On
			}
		}
		out = append(out, span{kind: GettingReady, from: from})
	}
	return out
}

// chapterFor is the index of the chapter holding on. Moments before the
// first chapter go to the first one, later ones to the last.
func (b *builder) chapterFor(spans []span, on time.Time) int {
	for i, s := range spans {
		if on.Before(s.from) {
			return max(i-1, 0)
		}
		if s.to.IsZero() || on.Before(s.to) {
			return i
		}
	}
	return len(spans) - 1
}

func (b *builder) chapter(s span, last bool) Chapter {
	ch := Chapter{Kind: s.kind, StartsOn: s.from, Current: last, Moments: []Moment{}}
	if !s.to.IsZero() && !last {
		e := s.to.AddDate(0, 0, -1)
		ch.EndsOn = &e
	}
	name := b.childName
	switch s.kind {
	case GettingReady:
		ch.Title, ch.Stage = "Getting ready together", b.in.Stage
		if ch.Stage != "planning" && ch.Stage != "trying" {
			ch.Title = "Where our story starts"
		}
	case Trimester1:
		ch.Title, ch.Span, ch.Stage = "The secret weeks", "Weeks 1 to 13", "pregnancy"
	case Trimester2:
		ch.Title, ch.Span, ch.Stage = "Getting to know you", "Weeks 14 to 27", "pregnancy"
	case Trimester3:
		ch.Title, ch.Span, ch.Stage = "Almost here", "Weeks 28 to 40", "pregnancy"
	case Newborn:
		ch.Title, ch.Span, ch.Stage = fmt.Sprintf("%s is home", name), "The first 12 weeks", "postpartum"
	case FirstYear:
		ch.Title, ch.Span, ch.Stage = fmt.Sprintf("%s's first year", name), "3 to 11 months", "infant"
	case Toddler:
		ch.Title, ch.Span, ch.Stage = "Little steps, big words", "1 and 2 years", "toddler"
	case Preschool:
		ch.Title, ch.Span, ch.Stage = "Stories and make-believe", "3 and 4 years", "preschool"
	case SchoolAge:
		ch.Title, ch.Span, ch.Stage = "Off to school", "5 years and up", "school_age"
	}
	if strings.HasPrefix(s.kind, "trimester_") {
		top := map[string]int{Trimester1: 13, Trimester2: 27, Trimester3: 40}[s.kind]
		if size, _, ok := content.SizeFor(max(min(top, b.lastWeek), 4)); ok {
			ch.Comparison = size.Comparison
		}
	}
	return ch
}

func (b *builder) has(kind string) bool {
	return slices.ContainsFunc(b.moments, func(m Moment) bool { return m.Kind == kind })
}

// invitations say what writes the next pages: dated ones first (the next key
// week, the next age line), then what the parents can do themselves.
func (b *builder) invitations() []Invitation {
	var out []Invitation
	dated := func(kind, title string, on time.Time) {
		out = append(out, Invitation{Kind: kind, Title: title, On: &on})
	}
	if b.pregnant && b.birth.IsZero() {
		for _, w := range keyWeeks {
			if w > b.lastWeek {
				if size, _, ok := content.SizeFor(w); ok {
					dated(PregnancyWeek, fmt.Sprintf("week %d begins, about the size of %s", w, size.Comparison), b.pregnancyWeek(w))
				}
				break
			}
		}
		out = append(out, Invitation{Kind: BabyHome, Title: "your baby comes home"})
	}
	if !b.birth.IsZero() {
		for _, m := range lineMonths {
			at := b.birth.AddDate(0, m, 0)
			if at.After(b.today) {
				dated(StageLine, fmt.Sprintf("%s turns %s", b.childName, ageWords(m)), at)
				break
			}
		}
		if !b.has(CareLog) && b.in.Viewer.has("care_log") && b.today.Before(b.birth.AddDate(1, 0, 0)) {
			out = append(out, Invitation{Kind: CareLog, Title: fmt.Sprintf("you log %s's first feed or nap", b.childName)})
		}
	}
	if b.in.Viewer.parent() {
		if !b.has(NamesLiked) && b.birth.IsZero() {
			out = append(out, Invitation{Kind: NamesLiked, Title: "you both like the same name"})
		}
		if !b.has(QuizCompared) {
			out = append(out, Invitation{Kind: QuizCompared, Title: "you both answer a lesson's quiz and compare"})
		}
		if !b.has(CoupleTalk) {
			out = append(out, Invitation{Kind: CoupleTalk, Title: "you talk about tonight's question together"})
		}
		if !b.has(Journal) {
			out = append(out, Invitation{Kind: Journal, Title: "one of you shares a journal line with the other"})
		}
		if !b.has(Appointment) {
			out = append(out, Invitation{Kind: Appointment, Title: "you go to a visit together"})
		}
	}
	if len(out) == 0 {
		out = append(out, Invitation{Kind: Journal, Title: "something new happens to your family"})
	}
	// A short list reads as an invitation; a long one reads as a to-do list.
	return out[:min(len(out), 4)]
}

func ageWords(months int) string {
	switch {
	case months < 12:
		return fmt.Sprintf("%d months", months)
	case months%12 == 0:
		if months == 12 {
			return "one"
		}
		return fmt.Sprintf("%d", months/12)
	case months%12 == 6:
		return fmt.Sprintf("%d and a half", months/12)
	}
	return fmt.Sprintf("%d months", months)
}

func (b *builder) parents() []uuid.UUID {
	out := []uuid.UUID{}
	for _, p := range b.in.People {
		if p.Role == "mother" || p.Role == "partner" {
			out = append(out, p.ID)
		}
	}
	return out
}

// learning adds lessons finished, quizzes both parents answered, talks had
// and the names both like.
func (b *builder) learning() {
	type read struct {
		people []uuid.UUID
		first  time.Time
	}
	reads := map[string]*read{}
	var order []string
	for _, r := range b.in.Reads {
		if !r.FinishedAt.Valid {
			continue
		}
		if _, ok := content.LessonByID(r.LessonID); !ok {
			continue
		}
		x, ok := reads[r.LessonID]
		if !ok {
			x = &read{first: r.FinishedAt.Time}
			reads[r.LessonID] = x
			order = append(order, r.LessonID)
		}
		x.people = append(x.people, r.MemberID)
		if r.FinishedAt.Time.Before(x.first) {
			x.first = r.FinishedAt.Time
		}
	}
	slices.Sort(order)
	for _, id := range order {
		l, _ := content.LessonByID(id)
		x := reads[id]
		slices.SortFunc(x.people, func(a, c uuid.UUID) int { return strings.Compare(b.name(a), b.name(c)) })
		title := fmt.Sprintf("%s read \u201c%s\u201d", b.name(x.people[0]), l.Title)
		if len(x.people) > 1 {
			title = fmt.Sprintf("You both read \u201c%s\u201d", l.Title)
		}
		b.add(Moment{ID: "lesson-" + id, Kind: LessonRead, On: day(x.first), Title: title, People: x.people})
	}

	// A quiz is compared once both parents answered every question of it.
	answered := map[uuid.UUID]map[string]time.Time{}
	for _, a := range b.in.Answers {
		if answered[a.MemberID] == nil {
			answered[a.MemberID] = map[string]time.Time{}
		}
		answered[a.MemberID][a.QuestionID] = a.AnsweredAt
	}
	parents := b.parents()
	if len(parents) == 2 {
		for _, id := range order {
			l, _ := content.LessonByID(id)
			if len(l.Quiz) == 0 {
				continue
			}
			var last time.Time
			both := true
			for _, q := range l.Quiz {
				for _, p := range parents {
					at, ok := answered[p][q.ID]
					if !ok {
						both = false
						break
					}
					if at.After(last) {
						last = at
					}
				}
			}
			if both {
				b.add(Moment{ID: "quiz-" + id, Kind: QuizCompared, On: day(last), Title: fmt.Sprintf("You compared answers on \u201c%s\u201d", l.Title), People: parents, Count: len(l.Quiz)})
			}
		}
	}

	for _, t := range b.in.Talks {
		text := ""
		if lid, ok := strings.CutPrefix(t.PromptID, content.LessonPromptPrefix); ok {
			if l, ok := content.LessonByID(lid); ok {
				text = l.TalkPrompt
			}
		} else {
			text, _, _ = content.TalkPromptText(content.State{}, t.PromptID)
		}
		if text == "" {
			continue
		}
		b.add(Moment{ID: "talk-" + t.PromptID, Kind: CoupleTalk, On: day(t.TalkedAt), Title: "You talked about it", Quote: quote(text), People: parents})
	}

	var both []string
	var last time.Time
	for _, n := range slices.Backward(b.in.Names) { // the query is newest first
		if len(parents) == 2 && slices.Contains(n.LikedBy, parents[0]) && slices.Contains(n.LikedBy, parents[1]) {
			both = append(both, n.Name)
			if n.CreatedAt.After(last) {
				last = n.CreatedAt
			}
		}
	}
	if len(both) > 0 {
		title := fmt.Sprintf("You both like %s", listNames(both))
		b.add(Moment{ID: "names", Kind: NamesLiked, On: day(last), Title: title, Detail: "Names on your shared list that both of you liked.", People: parents, Count: len(both)})
	}
}
