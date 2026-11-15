// Package together owns the couple layer around learning: the partner nudge,
// this week's talk prompts with the shared "we talked about it" record, and
// the shared baby name list. Everything here is shared by the two parents and
// scoped to one family; caregivers never reach it (the handlers are parents
// only).
package together

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/couplelab"
	"github.com/unsound-mint/parenting-planner/api/internal/learn"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrUnknownPrompt = errors.New("unknown prompt")
	ErrNameExists    = errors.New("name exists")
	ErrUnknownName   = errors.New("unknown name")
	ErrEmptyName     = errors.New("empty name")
)

const (
	// NudgeWindow is how far back the partner nudge looks.
	NudgeWindow = 7 * 24 * time.Hour
	// RecentReadWindow is how long a finished lesson's talk prompt leads the list.
	RecentReadWindow = 14 * 24 * time.Hour
)

type NudgeKind string

const (
	NudgeLessonFinished NudgeKind = "lesson_finished"
	NudgeQuizAnswered   NudgeKind = "quiz_answered"
	NudgeNameAdded      NudgeKind = "name_added"
)

type Nudge struct {
	// Key is stable for the same activity, so a parent can close the nudge
	// (nudge_dismissals) and it stays closed.
	Key      string
	MemberID uuid.UUID
	Kind     NudgeKind
	At       time.Time
	LessonID string
	Name     string
	Text     string
}

type Prompt struct {
	ID, Text, LessonID string
	TalkedAt           *time.Time
	TalkedBy           uuid.UUID
}

// Card is the "Tonight, together" card for the acting parent.
type Card struct {
	Nudge   *Nudge
	Prompts []Prompt
	// Closed holds the keys of nudges this parent closed in the last 30 days,
	// so the client can hide the ones it builds itself (the quiz strip).
	Closed []string
}

// closedFor is how long a closed nudge key is reported back. Keys carry the
// time of the activity, so an old key can never match a new nudge anyway.
const closedFor = 30 * 24 * time.Hour

// Other is the other parent as the card names them.
type Other struct {
	ID   uuid.UUID
	Name string
}

// GetCard builds the nudge from the other parent's activity and orders this
// week's prompts. today is the family's date on the demo clock; now its time.
func GetCard(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, me uuid.UUID, other Other, st content.State, today, now time.Time) (Card, error) {
	q := store.New(pool)
	reads, err := q.ListLessonReads(ctx, familyID)
	if err != nil {
		return Card{}, err
	}
	talks, err := q.ListCoupleTalks(ctx, familyID)
	if err != nil {
		return Card{}, err
	}
	card := Card{Prompts: []Prompt{}}
	if other.ID != uuid.Nil {
		answers, err := q.ListQuizAnswers(ctx, familyID)
		if err != nil {
			return Card{}, err
		}
		names, err := q.ListBabyNames(ctx, familyID)
		if err != nil {
			return Card{}, err
		}
		card.Nudge = nudge(other, reads, answers, names, today, now)
	}
	closed, err := q.ListNudgeDismissals(ctx, store.ListNudgeDismissalsParams{FamilyID: familyID, MemberID: me, Since: now.Add(-closedFor)})
	if err != nil {
		return Card{}, err
	}
	card.Closed = closed
	// A closed nudge stays closed; an older activity does not take its place.
	if card.Nudge != nil && slices.Contains(closed, card.Nudge.Key) {
		card.Nudge = nil
	}
	lab, err := couplelab.List(ctx, pool, familyID, me, other.ID)
	if err != nil {
		return Card{}, err
	}
	card.Prompts = prompts(me, other.ID, st, reads, talks, couplelab.TalkPrompts(lab), now)
	return card, nil
}

// nudge picks the other parent's latest activity in the window: a finished
// lesson first, then a quiz answer, then a name they added.
func nudge(other Other, reads []store.LessonRead, answers []store.QuizAnswer, names []store.ListBabyNamesRow, today, now time.Time) *Nudge {
	since := now.Add(-NudgeWindow)
	in := func(t time.Time) bool { return !t.Before(since) && !t.After(now) }

	var best *Nudge
	for _, r := range reads {
		if r.MemberID != other.ID || !r.FinishedAt.Valid || !in(r.FinishedAt.Time) {
			continue
		}
		if best == nil || r.FinishedAt.Time.After(best.At) {
			best = &Nudge{MemberID: other.ID, Kind: NudgeLessonFinished, At: r.FinishedAt.Time, LessonID: r.LessonID}
		}
	}
	if best == nil {
		for _, a := range answers {
			if a.MemberID != other.ID || !in(a.AnsweredAt) {
				continue
			}
			if best == nil || a.AnsweredAt.After(best.At) {
				lessonID, _ := questionLesson(a.QuestionID)
				best = &Nudge{MemberID: other.ID, Kind: NudgeQuizAnswered, At: a.AnsweredAt, LessonID: lessonID}
			}
		}
	}
	if best == nil {
		for _, n := range names {
			if n.AddedBy != other.ID || !in(n.CreatedAt) {
				continue
			}
			if best == nil || n.CreatedAt.After(best.At) {
				best = &Nudge{MemberID: other.ID, Kind: NudgeNameAdded, At: n.CreatedAt, Name: n.Name}
			}
		}
	}
	if best == nil {
		return nil
	}
	best.Key = fmt.Sprintf("%s:%s%s:%d", best.Kind, best.LessonID, best.Name, best.At.Unix())
	when := relativeDay(best.At, today)
	switch best.Kind {
	case NudgeLessonFinished:
		l, _ := content.LessonByID(best.LessonID)
		best.Text = fmt.Sprintf("%s finished %q %s. Ask what stood out.", other.Name, l.Title, when)
	case NudgeQuizAnswered:
		l, _ := content.LessonByID(best.LessonID)
		best.Text = fmt.Sprintf("%s took the quiz on %q %s. Compare answers tonight.", other.Name, l.Title, when)
	case NudgeNameAdded:
		best.Text = fmt.Sprintf("%s added %s to your name list %s.", other.Name, best.Name, when)
	}
	return best
}

// questionLesson finds the lesson of a question id (lessonId-qN). Lesson ids
// contain hyphens, so cut at the last "-q".
func questionLesson(questionID string) (string, bool) {
	i := strings.LastIndex(questionID, "-q")
	if i <= 0 {
		return "", false
	}
	_, ok := content.LessonByID(questionID[:i])
	return questionID[:i], ok
}

// relativeDay words a time against the family's date: today, yesterday, or
// the weekday within the last week, then "a week ago". Dates are UTC like the rest of the plan.
func relativeDay(t, today time.Time) string {
	y, m, d := t.UTC().Date()
	day := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	switch days := int(today.Sub(day).Hours() / 24); {
	case days <= 0:
		return "today"
	case days == 1:
		return "yesterday"
	case days >= 7:
		return "a week ago"
	default:
		return "on " + day.Weekday().String()
	}
}

// prompts orders the week's talk prompts: prompts of lessons either parent
// finished in the last two weeks (latest first), then the pool for this week,
// then prompts of lessons open now; prompts already talked about go last,
// latest first. Lab cards whose answers differ come after the lessons' prompts
// (a conversation the couple chose to open). "Another question" in the UI is the next item.
func prompts(me, other uuid.UUID, st content.State, reads []store.LessonRead, talks []store.CoupleTalk, lab []couplelab.Card, now time.Time) []Prompt {
	talked := map[string]store.CoupleTalk{}
	for _, t := range talks {
		talked[t.PromptID] = t
	}
	seen := map[string]bool{}
	var open, done []Prompt
	add := func(id, text, lessonID string) {
		if seen[id] || text == "" {
			return
		}
		seen[id] = true
		p := Prompt{ID: id, Text: text, LessonID: lessonID}
		if t, ok := talked[id]; ok {
			at := t.TalkedAt
			p.TalkedAt, p.TalkedBy = &at, t.TalkedBy
			done = append(done, p)
			return
		}
		open = append(open, p)
	}

	recent := slices.DeleteFunc(slices.Clone(reads), func(r store.LessonRead) bool {
		return (r.MemberID != me && r.MemberID != other) || !r.FinishedAt.Valid || r.FinishedAt.Time.Before(now.Add(-RecentReadWindow))
	})
	slices.SortStableFunc(recent, func(a, b store.LessonRead) int { return b.FinishedAt.Time.Compare(a.FinishedAt.Time) })
	for _, r := range recent {
		if l, ok := content.LessonFor(st, r.LessonID); ok {
			add(content.LessonPromptPrefix+l.ID, l.TalkPrompt, l.ID)
		}
	}
	for _, p := range content.CoupleTalkPrompts(st, now) {
		add(p.ID, p.Text, "")
	}
	for _, path := range content.LearnPathsFor(st) {
		for _, l := range path.Lessons {
			if s := l.StateOf(st); s.Timing == content.TimingNow && !s.Locked {
				add(content.LessonPromptPrefix+l.ID, l.TalkPrompt, l.ID)
			}
		}
	}
	// Cards of the Compatibility Lab where the two answers differ.
	for _, c := range lab {
		add(couplelab.PromptPrefix+c.ID, c.Prompt, "")
	}
	slices.SortStableFunc(done, func(a, b Prompt) int { return b.TalkedAt.Compare(*a.TalkedAt) })
	return append(open, done...)
}

// Dismiss closes a nudge for the acting parent. Repeating it is fine.
func Dismiss(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, key string, now time.Time) error {
	return store.New(pool).DismissNudge(ctx, store.DismissNudgeParams{FamilyID: familyID, MemberID: actor, NudgeKey: key, DismissedAt: now})
}

// Talk records that the couple talked about a prompt. The first record wins.
func Talk(ctx context.Context, pool *pgxpool.Pool, familyID, actor, other uuid.UUID, st content.State, promptID string, now time.Time) (store.CoupleTalk, error) {
	if id, ok := strings.CutPrefix(promptID, couplelab.PromptPrefix); ok {
		// A lab prompt exists for this family only once both parents answered the card differently.
		lab, err := couplelab.List(ctx, pool, familyID, actor, other)
		if err != nil {
			return store.CoupleTalk{}, err
		}
		if !slices.ContainsFunc(couplelab.TalkPrompts(lab), func(c couplelab.Card) bool { return c.ID == id }) {
			return store.CoupleTalk{}, ErrUnknownPrompt
		}
	} else if _, _, ok := content.TalkPromptText(st, promptID); !ok {
		return store.CoupleTalk{}, ErrUnknownPrompt
	}
	return store.New(pool).CreateCoupleTalk(ctx, store.CreateCoupleTalkParams{
		FamilyID: familyID, PromptID: promptID, TalkedBy: actor, TalkedAt: now,
	})
}

// Name is a name on the shared list.
type Name struct {
	ID        uuid.UUID
	Name      string
	AddedBy   uuid.UUID
	LikedBy   []uuid.UUID
	BothLike  bool
	CreatedAt time.Time
}

func nameOut(id uuid.UUID, name string, addedBy uuid.UUID, likedBy []uuid.UUID, created time.Time, parents []uuid.UUID) Name {
	both := len(parents) == 2
	for _, p := range parents {
		both = both && slices.Contains(likedBy, p)
	}
	return Name{ID: id, Name: name, AddedBy: addedBy, LikedBy: likedBy, BothLike: both, CreatedAt: created}
}

// ListNames returns names both parents like first, then names someone likes,
// newest first within each.
func ListNames(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, parents []uuid.UUID) ([]Name, error) {
	rows, err := store.New(pool).ListBabyNames(ctx, familyID)
	if err != nil {
		return nil, err
	}
	out := make([]Name, 0, len(rows))
	for _, r := range rows {
		out = append(out, nameOut(r.ID, r.Name, r.AddedBy, r.LikedBy, r.CreatedAt, parents))
	}
	rank := func(n Name) int {
		switch {
		case n.BothLike:
			return 0
		case len(n.LikedBy) > 0:
			return 1
		}
		return 2
	}
	slices.SortStableFunc(out, func(a, b Name) int { return rank(a) - rank(b) })
	return out, nil
}

// AddName puts a name on the list; the parent who adds it likes it.
func AddName(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, parents []uuid.UUID, name string, now time.Time) (Name, error) {
	name = strings.Join(strings.Fields(name), " ")
	if name == "" {
		return Name{}, ErrEmptyName
	}
	var out Name
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		row, err := q.CreateBabyName(ctx, store.CreateBabyNameParams{FamilyID: familyID, Name: name, AddedBy: actor, CreatedAt: now})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNameExists
		}
		if err != nil {
			return err
		}
		if err := q.LikeBabyName(ctx, store.LikeBabyNameParams{MemberID: actor, CreatedAt: now, NameID: row.ID, FamilyID: familyID}); err != nil {
			return err
		}
		// The other parent may already love it in the names quest: then it is a match.
		swipes, err := q.ListNameSwipes(ctx, familyID)
		if err != nil {
			return err
		}
		liked := []uuid.UUID{actor}
		for _, s := range swipes {
			if s.MemberID != actor && slices.Contains(parents, s.MemberID) && s.Verdict == string(Love) && strings.EqualFold(s.Name, name) {
				if err := q.LikeBabyName(ctx, store.LikeBabyNameParams{MemberID: s.MemberID, CreatedAt: now, NameID: row.ID, FamilyID: familyID}); err != nil {
					return err
				}
				liked = append(liked, s.MemberID)
			}
		}
		out = nameOut(row.ID, row.Name, row.AddedBy, liked, row.CreatedAt, parents)
		return nil
	})
	return out, err
}

// SetLike adds or takes back the acting parent's like. Both are idempotent.
func SetLike(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, parents []uuid.UUID, nameID uuid.UUID, like bool, now time.Time) (Name, error) {
	var out Name
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.GetBabyName(ctx, store.GetBabyNameParams{FamilyID: familyID, ID: nameID}); errors.Is(err, pgx.ErrNoRows) {
			return ErrUnknownName
		} else if err != nil {
			return err
		}
		var err error
		if like {
			err = q.LikeBabyName(ctx, store.LikeBabyNameParams{MemberID: actor, CreatedAt: now, NameID: nameID, FamilyID: familyID})
		} else {
			err = q.UnlikeBabyName(ctx, store.UnlikeBabyNameParams{NameID: nameID, FamilyID: familyID, MemberID: actor})
			if err == nil {
				// Taking back a like also takes back a "love" from the names quest.
				var row store.GetBabyNameRow
				if row, err = q.GetBabyName(ctx, store.GetBabyNameParams{FamilyID: familyID, ID: nameID}); err == nil {
					err = q.DeleteNameSwipe(ctx, store.DeleteNameSwipeParams{FamilyID: familyID, MemberID: actor, Name: row.Name})
				}
			}
		}
		if err != nil {
			return err
		}
		row, err := q.GetBabyName(ctx, store.GetBabyNameParams{FamilyID: familyID, ID: nameID})
		if err != nil {
			return err
		}
		out = nameOut(row.ID, row.Name, row.AddedBy, row.LikedBy, row.CreatedAt, parents)
		return nil
	})
	return out, err
}

// Couple resolves the acting parent and the other parent from the family's parents.
func Couple(parents []store.Member, me uuid.UUID) (learn.Couple, Other) {
	c := learn.Couple{Me: me}
	var o Other
	for _, p := range parents {
		if p.ID != me {
			c.Other, o = p.ID, Other{ID: p.ID, Name: p.DisplayName}
		}
	}
	return c, o
}
