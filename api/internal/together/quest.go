package together

import (
	"context"
	"errors"
	"hash/fnv"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// The names quest: each parent swipes a deck of names on their own (love,
// maybe, not for us), names both love become matches on the shared list, and
// a final round of head-to-head picks ends in the couple's top three.
//
// Privacy: a parent's answer on a name is shown to the other parent only after
// the other has answered that name too (Visible). Swipes live in
// baby_name_swipes, not in the shared list, so GET baby-names, the likes and
// the partner nudge only ever see matches and names added by hand.

var (
	ErrQuestClosed  = errors.New("names quest closed")
	ErrUnknownList  = errors.New("unknown list")
	ErrFinalLocked  = errors.New("final round locked")
	ErrNotFinalist  = errors.New("not a finalist")
	ErrSameFinalist = errors.New("same finalist")
)

type Verdict string

const (
	Love  Verdict = "love"
	Maybe Verdict = "maybe"
	No    Verdict = "no"
)

const (
	SwipeGoal  = 30
	MatchGoal  = 5
	DeckSize   = 40
	FinalSize  = 6
	StageLists = "lists"
	StageSwipe = "swipe"
	StageMatch = "matches"
	StageFinal = "final"
)

// QuestOpen says whether the family can play: before a birth, and not in
// pregnancy loss support (the server moves such a family to planning).
func QuestOpen(f store.Family) bool {
	return slices.Contains([]string{"planning", "trying", "pregnancy"}, f.Stage) && !f.PregnancyLossRecordedAt.Valid
}

// Visible reports whether a reader may see the other parent's answer on a
// name: only once the reader has answered it too. Every place that shows the
// other parent's verdict goes through this.
func Visible(mine Verdict) bool { return mine != "" }

// NameCard is a name in the deck, on the shortlist or in the final round.
type NameCard struct {
	ID      uuid.UUID // on the shared list; Nil when it is only in the catalog
	Name    string
	Catalog *content.CatalogName
	AddedBy uuid.UUID // a parent's own name
}

type Progress struct {
	MemberID uuid.UUID
	Swiped   int
	Judged   int
}

type Stage struct {
	ID   string
	Done bool
}

type NameTalk struct {
	Card         NameCard
	Mine, Theirs Verdict
}

type Quest struct {
	Chosen     []string
	Progress   []Progress
	Stages     []Stage
	Matches    []NameCard
	TalkAbout  []NameTalk
	PairCount  int
	NextPair   []NameCard
	Top        []NameCard
	FinishedAt *time.Time
}

type SwipeResult struct {
	Name    string
	Verdict Verdict
	Theirs  Verdict // empty when the other parent has not answered
	Match   bool
	Card    NameCard
}

// state is everything the quest reads for one family.
type state struct {
	me, other uuid.UUID
	chosen    []string
	swipes    map[uuid.UUID]map[string]Verdict // member -> lower(name) -> verdict
	rows      []store.ListBabyNamesRow
	duels     []store.BabyNameDuel
}

func key(name string) string { return strings.ToLower(strings.TrimSpace(name)) }

func load(ctx context.Context, q *store.Queries, familyID, me, other uuid.UUID) (state, error) {
	st := state{me: me, other: other, swipes: map[uuid.UUID]map[string]Verdict{me: {}, other: {}}}
	quest, err := q.GetNamesQuest(ctx, familyID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
	case err != nil:
		return st, err
	default:
		st.chosen = quest.Lists
	}
	swipes, err := q.ListNameSwipes(ctx, familyID)
	if err != nil {
		return st, err
	}
	for _, s := range swipes {
		if m, ok := st.swipes[s.MemberID]; ok {
			m[key(s.Name)] = Verdict(s.Verdict)
		}
	}
	if st.rows, err = q.ListBabyNames(ctx, familyID); err != nil {
		return st, err
	}
	st.duels, err = q.ListNameDuels(ctx, familyID)
	return st, err
}

// verdict is a parent's answer on a name: a like on the shared list is a love
// (added by hand, or liked on This week); otherwise their swipe.
func (st state) verdict(member uuid.UUID, name string) Verdict {
	k := key(name)
	for _, r := range st.rows {
		if key(r.Name) == k && slices.Contains(r.LikedBy, member) {
			return Love
		}
	}
	return st.swipes[member][k]
}

func (st state) answered(member uuid.UUID) map[string]bool {
	out := map[string]bool{}
	for k := range st.swipes[member] {
		out[k] = true
	}
	for _, r := range st.rows {
		if slices.Contains(r.LikedBy, member) && r.AddedBy != member {
			out[key(r.Name)] = true
		}
	}
	return out
}

func (st state) both(r store.ListBabyNamesRow) bool {
	return st.other != uuid.Nil && slices.Contains(r.LikedBy, st.me) && slices.Contains(r.LikedBy, st.other)
}

func cardOf(name string, id, addedBy uuid.UUID) NameCard {
	c := NameCard{ID: id, Name: name, AddedBy: addedBy}
	if n, ok := content.Names().Name(name); ok {
		c.Catalog = &n
		c.Name = n.Name
	}
	return c
}

// rowCard is a name on the shared list. A name the adder typed (no swipe of
// theirs on it) keeps who added it; a match from the deck does not.
func (st state) rowCard(r store.ListBabyNamesRow) NameCard {
	c := cardOf(r.Name, r.ID, uuid.Nil)
	if st.typed(r) {
		c.AddedBy = r.AddedBy
	}
	return c
}

func (st state) typed(r store.ListBabyNamesRow) bool {
	return st.swipes[r.AddedBy][key(r.Name)] == ""
}

// matches are names both parents love, newest first (the list is newest first).
func (st state) matches() []store.ListBabyNamesRow {
	var out []store.ListBabyNamesRow
	for _, r := range st.rows {
		if st.both(r) {
			out = append(out, r)
		}
	}
	return out
}

// finalists are the first FinalSize matches, in the order they matched.
func (st state) finalists() []store.ListBabyNamesRow {
	m := slices.Clone(st.matches())
	slices.SortStableFunc(m, func(a, b store.ListBabyNamesRow) int { return a.CreatedAt.Compare(b.CreatedAt) })
	if len(m) > FinalSize {
		m = m[:FinalSize]
	}
	return m
}

type pair struct{ a, b store.ListBabyNamesRow }

// pairs schedules every pair of finalists, neighbours first, so each name
// shows up early.
func pairs(f []store.ListBabyNamesRow) []pair {
	var out []pair
	for gap := 1; gap < len(f); gap++ {
		for i := 0; i+gap < len(f); i++ {
			out = append(out, pair{f[i], f[i+gap]})
		}
	}
	return out
}

func lowHigh(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if strings.Compare(a.String(), b.String()) < 0 {
		return a, b
	}
	return b, a
}

func (st state) judged(member uuid.UUID, ps []pair) (n int, next *pair, last time.Time) {
	done := map[[2]uuid.UUID]time.Time{}
	for _, d := range st.duels {
		if d.MemberID == member {
			done[[2]uuid.UUID{d.LowID, d.HighID}] = d.JudgedAt
		}
	}
	for i, p := range ps {
		lo, hi := lowHigh(p.a.ID, p.b.ID)
		if at, ok := done[[2]uuid.UUID{lo, hi}]; ok {
			n++
			if at.After(last) {
				last = at
			}
		} else if next == nil {
			next = &ps[i]
		}
	}
	return n, next, last
}

func (st state) quest() Quest {
	q := Quest{Chosen: st.chosen}
	if q.Chosen == nil {
		q.Chosen = []string{}
	}
	parents := []uuid.UUID{st.me}
	if st.other != uuid.Nil {
		parents = append(parents, st.other)
	}

	unlocked := len(st.matches()) >= MatchGoal
	var ps []pair
	if unlocked {
		ps = pairs(st.finalists())
	}
	q.PairCount = len(ps)
	allSwiped, allJudged := len(parents) == 2, unlocked && len(parents) == 2
	var finished time.Time
	for _, p := range parents {
		swiped := len(st.answered(p))
		judged, next, last := st.judged(p, ps)
		q.Progress = append(q.Progress, Progress{MemberID: p, Swiped: swiped, Judged: judged})
		allSwiped = allSwiped && swiped >= SwipeGoal
		allJudged = allJudged && judged == len(ps)
		if last.After(finished) {
			finished = last
		}
		if p == st.me && next != nil {
			q.NextPair = []NameCard{st.rowCard(next.a), st.rowCard(next.b)}
		}
	}
	if allJudged {
		q.FinishedAt = &finished
	}

	for _, r := range st.matches() {
		q.Matches = append(q.Matches, st.rowCard(r))
	}
	q.TalkAbout = st.talkAbout()
	q.Top = st.top(st.finalists())

	q.Stages = []Stage{
		{StageLists, len(st.chosen) > 0},
		{StageSwipe, allSwiped},
		{StageMatch, unlocked},
		{StageFinal, allJudged},
	}
	return q
}

// talkAbout lists names both parents answered where one said love and the
// other maybe: worth a conversation. Both answered, so both may see both.
func (st state) talkAbout() []NameTalk {
	if st.other == uuid.Nil {
		return nil
	}
	var out []NameTalk
	seen := map[string]bool{}
	for k := range st.swipes[st.me] {
		if seen[k] {
			continue
		}
		seen[k] = true
		mine, theirs := st.verdict(st.me, k), st.verdict(st.other, k)
		if !Visible(mine) || theirs == "" {
			continue
		}
		if (mine == Love && theirs == Maybe) || (mine == Maybe && theirs == Love) {
			out = append(out, NameTalk{Card: cardOf(k, uuid.Nil, uuid.Nil), Mine: mine, Theirs: theirs})
		}
	}
	slices.SortFunc(out, func(a, b NameTalk) int { return strings.Compare(a.Card.Name, b.Card.Name) })
	return out
}

// top ranks finalists by both parents' picks, then by when they matched.
func (st state) top(f []store.ListBabyNamesRow) []NameCard {
	wins := map[uuid.UUID]int{}
	any := false
	for _, d := range st.duels {
		for _, r := range f {
			if r.ID == d.WinnerID {
				wins[r.ID]++
				any = true
			}
		}
	}
	if !any {
		return nil
	}
	ranked := slices.Clone(f)
	slices.SortStableFunc(ranked, func(a, b store.ListBabyNamesRow) int { return wins[b.ID] - wins[a.ID] })
	var out []NameCard
	for _, r := range ranked[:min(3, len(ranked))] {
		out = append(out, st.rowCard(r))
	}
	return out
}

// GetQuest is the quest as the acting parent sees it.
func GetQuest(ctx context.Context, pool *pgxpool.Pool, familyID, me, other uuid.UUID) (Quest, error) {
	st, err := load(ctx, store.New(pool), familyID, me, other)
	if err != nil {
		return Quest{}, err
	}
	return st.quest(), nil
}

// SetLists stores the lists the couple builds the deck from.
func SetLists(ctx context.Context, pool *pgxpool.Pool, familyID, me, other uuid.UUID, lists []string, now time.Time) (Quest, error) {
	var clean []string
	for _, l := range lists {
		if !content.Names().HasList(l) {
			return Quest{}, ErrUnknownList
		}
		if !slices.Contains(clean, l) {
			clean = append(clean, l)
		}
	}
	q := store.New(pool)
	if err := q.SetNamesQuestLists(ctx, store.SetNamesQuestListsParams{FamilyID: familyID, Lists: clean, UpdatedBy: me, UpdatedAt: now}); err != nil {
		return Quest{}, err
	}
	return GetQuest(ctx, pool, familyID, me, other)
}

// DeckFilter narrows the deck: Sex is girl, boy or neutral (neutral names are
// in every deck); MinBabies and MaxBabies bound the latest year's count.
type DeckFilter struct {
	Sex                  string
	MinBabies, MaxBabies *int
}

func (f DeckFilter) keeps(n *content.CatalogName) bool {
	if n == nil {
		return true // a parent's own name: always in the other parent's deck
	}
	switch f.Sex {
	case "girl":
		if n.Sex == "M" {
			return false
		}
	case "boy":
		if n.Sex == "F" {
			return false
		}
	case "neutral":
		if n.Sex != "N" {
			return false
		}
	}
	b := n.Babies()
	return (f.MinBabies == nil || b >= *f.MinBabies) && (f.MaxBabies == nil || b <= *f.MaxBabies)
}

// shuffle orders a parent's deck the same way on every load, but differently
// for each parent.
func shuffle(member uuid.UUID, name string) uint32 {
	h := fnv.New32a()
	h.Write(member[:])
	h.Write([]byte(strings.ToLower(name)))
	return h.Sum32()
}

// Deck is the acting parent's next cards and how many are left. Names the
// other parent added come first, then names the other parent answered (any
// answer, so the order says nothing about it), then the rest.
func Deck(ctx context.Context, pool *pgxpool.Pool, familyID, me, other uuid.UUID, f DeckFilter) ([]NameCard, int, error) {
	st, err := load(ctx, store.New(pool), familyID, me, other)
	if err != nil {
		return nil, 0, err
	}
	done := st.answered(me)
	type ranked struct {
		card  NameCard
		group int
		order uint32
	}
	var all []ranked
	seen := map[string]bool{}
	for _, r := range st.rows {
		k := key(r.Name)
		if r.AddedBy == me || done[k] || st.both(r) || !slices.Contains(r.LikedBy, r.AddedBy) {
			continue
		}
		c := st.rowCard(r)
		seen[k] = true
		if f.keeps(c.Catalog) {
			all = append(all, ranked{c, 0, shuffle(me, r.Name)})
		}
	}
	cat := content.Names()
	for i := range cat.Names {
		n := &cat.Names[i]
		k := key(n.Name)
		if seen[k] || done[k] || !slices.ContainsFunc(n.Lists, func(l string) bool { return slices.Contains(st.chosen, l) }) || !f.keeps(n) {
			continue
		}
		seen[k] = true
		group := 2
		if st.swipes[other][k] != "" {
			group = 1
		}
		all = append(all, ranked{NameCard{Name: n.Name, Catalog: n}, group, shuffle(me, n.Name)})
	}
	slices.SortFunc(all, func(a, b ranked) int {
		if a.group != b.group {
			return a.group - b.group
		}
		if a.order != b.order {
			if a.order < b.order {
				return -1
			}
			return 1
		}
		return strings.Compare(a.card.Name, b.card.Name)
	})
	out := make([]NameCard, 0, min(DeckSize, len(all)))
	for _, r := range all[:min(DeckSize, len(all))] {
		out = append(out, r.card)
	}
	return out, len(all), nil
}

// Swipe records the acting parent's answer. Two loves make a match: the name
// joins the shared list liked by both, in the same transaction.
func Swipe(ctx context.Context, pool *pgxpool.Pool, familyID, me, other uuid.UUID, name string, v Verdict, now time.Time) (SwipeResult, error) {
	name = strings.Join(strings.Fields(name), " ")
	var out SwipeResult
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.GetBabyNameByName(ctx, store.GetBabyNameByNameParams{FamilyID: familyID, Name: name})
		hasRow := err == nil
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		cat, inCatalog := content.Names().Name(name)
		switch {
		case hasRow:
			name = row.Name
		case inCatalog:
			name = cat.Name
		default:
			return ErrUnknownName
		}
		if err := q.UpsertNameSwipe(ctx, store.UpsertNameSwipeParams{FamilyID: familyID, MemberID: me, Name: name, Verdict: string(v), SwipedAt: now}); err != nil {
			return err
		}
		st, err := load(ctx, q, familyID, me, other)
		if err != nil {
			return err
		}
		theirs := Verdict("")
		if other != uuid.Nil {
			theirs = st.verdict(other, name)
		}
		like := func(id, member uuid.UUID, at time.Time) error {
			return q.LikeBabyName(ctx, store.LikeBabyNameParams{MemberID: member, CreatedAt: at, NameID: id, FamilyID: familyID})
		}
		switch {
		case v == Love && hasRow:
			if err := like(row.ID, me, now); err != nil {
				return err
			}
		case v == Love && theirs == Love:
			created, err := q.CreateBabyName(ctx, store.CreateBabyNameParams{FamilyID: familyID, Name: name, AddedBy: me, CreatedAt: now})
			if err != nil {
				return err
			}
			row, hasRow = created, true
			if err := like(row.ID, other, now); err != nil {
				return err
			}
			if err := like(row.ID, me, now); err != nil {
				return err
			}
		case v != Love && hasRow:
			if err := q.UnlikeBabyName(ctx, store.UnlikeBabyNameParams{NameID: row.ID, FamilyID: familyID, MemberID: me}); err != nil {
				return err
			}
		}
		out = SwipeResult{Name: name, Verdict: v, Theirs: theirs, Match: v == Love && theirs == Love}
		id := uuid.Nil
		if hasRow {
			id = row.ID
		}
		out.Card = cardOf(name, id, uuid.Nil)
		return nil
	})
	return out, err
}

// Undo takes back the acting parent's answer on a name. Idempotent.
func Undo(ctx context.Context, pool *pgxpool.Pool, familyID, me uuid.UUID, name string) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if err := q.DeleteNameSwipe(ctx, store.DeleteNameSwipeParams{FamilyID: familyID, MemberID: me, Name: name}); err != nil {
			return err
		}
		row, err := q.GetBabyNameByName(ctx, store.GetBabyNameByNameParams{FamilyID: familyID, Name: name})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		return q.UnlikeBabyName(ctx, store.UnlikeBabyNameParams{NameID: row.ID, FamilyID: familyID, MemberID: me})
	})
}

// Judge records the acting parent's pick between two finalists.
func Judge(ctx context.Context, pool *pgxpool.Pool, familyID, me, other, winner, loser uuid.UUID, now time.Time) (Quest, error) {
	if winner == loser {
		return Quest{}, ErrSameFinalist
	}
	var out Quest
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		st, err := load(ctx, q, familyID, me, other)
		if err != nil {
			return err
		}
		if len(st.matches()) < MatchGoal {
			return ErrFinalLocked
		}
		f := st.finalists()
		in := func(id uuid.UUID) bool {
			return slices.ContainsFunc(f, func(r store.ListBabyNamesRow) bool { return r.ID == id })
		}
		if !in(winner) || !in(loser) {
			return ErrNotFinalist
		}
		wasDone := st.quest().FinishedAt != nil
		lo, hi := lowHigh(winner, loser)
		if err := q.UpsertNameDuel(ctx, store.UpsertNameDuelParams{FamilyID: familyID, MemberID: me, LowID: lo, HighID: hi, WinnerID: winner, JudgedAt: now}); err != nil {
			return err
		}
		if st, err = load(ctx, q, familyID, me, other); err != nil {
			return err
		}
		out = st.quest()
		if !wasDone && out.FinishedAt != nil {
			// TODO(stickers): award the "names quest" sticker to both parents
			// here once the missions-badges award hook is on main.
			_ = out
		}
		return nil
	})
	return out, err
}
