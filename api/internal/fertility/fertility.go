// Package fertility holds a parent's fertility journal, the preconception
// checklist and the journey preferences. It is the most sensitive data in the
// app, built like internal/diary: private to the author unless an item is
// shared with the partner (there is no family level, so caregivers never read
// any of it), every create, read, change and delete is audited in the same
// transaction, reads use the *VisibleToParent SQL, and free text is sealed.
//
// Nothing here feeds the plan, analytics, notifications, exports or live updates.
package fertility

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const (
	entityEntry     = "fertility_entry"
	entityChecklist = "preconception_tick"
	entitySettings  = "journey_settings"
	entityOverview  = "fertility_overview"
)

// ListWindow is how far back the journal looks. Planned tests have no upper limit.
const ListWindow = 180 * 24 * time.Hour

// overviewWindow is how far back period days are read for the estimate.
const overviewWindow = 400 * 24 * time.Hour

var (
	ErrNoEntry  = errors.New("no such fertility entry")
	ErrNoItem   = errors.New("no such checklist item")
	ErrNotShare = errors.New("visibility must be private or partner")
)

// Invalid is a validation error whose message is safe to show.
type Invalid string

func (e Invalid) Error() string { return string(e) }

// Visibility is private or partner; nothing wider exists for this data.
func validVisibility(v access.Visibility) bool { return v == access.Private || v == access.Partner }

type Entry struct {
	store.FertilityEntry
	Note string
}

type New struct {
	Kind       string
	Date       time.Time
	Code       *string
	TempC      *float64
	Note       string
	Visibility access.Visibility
}

func (n New) validate(today time.Time) (code *string, err error) {
	if !validVisibility(n.Visibility) {
		return nil, ErrNotShare
	}
	if n.Date.After(today) && n.Kind != "test" {
		return nil, Invalid("only a planned test can have a date in the future")
	}
	c := ""
	if n.Code != nil {
		c = strings.TrimSpace(*n.Code)
	}
	note := strings.TrimSpace(n.Note)
	switch n.Kind {
	case "period":
		if !periodFlows[c] {
			return nil, Invalid("period needs a code: spotting, light, medium or heavy")
		}
	case "symptom":
		if !Symptoms[c] {
			return nil, Invalid("unknown symptom")
		}
	case "ovulation_test":
		if !testResults[c] {
			return nil, Invalid("ovulation_test needs a code: negative, faint or positive")
		}
	case "bbt":
		if n.TempC == nil {
			return nil, Invalid("bbt needs tempC")
		}
	case "test", "treatment_note":
		if note == "" {
			return nil, Invalid("this entry needs a note")
		}
	default:
		return nil, Invalid("unknown kind")
	}
	if n.Kind != "period" && n.Kind != "symptom" && n.Kind != "ovulation_test" {
		return nil, nil
	}
	return &c, nil
}

func open(key crypt.Key, row store.FertilityEntry) (Entry, error) {
	e := Entry{FertilityEntry: row}
	if len(row.NoteSealed) == 0 {
		return e, nil
	}
	var err error
	e.Note, err = key.Open(row.NoteSealed)
	return e, err
}

func Create(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, actor uuid.UUID, in New, today time.Time) (Entry, error) {
	code, err := in.validate(today)
	if err != nil {
		return Entry{}, err
	}
	var sealed []byte
	if n := strings.TrimSpace(in.Note); n != "" {
		if sealed, err = key.Seal(n); err != nil {
			return Entry{}, err
		}
	}
	temp := in.TempC
	if in.Kind != "bbt" {
		temp = nil
	}
	var out Entry
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if in.Kind == "period" || in.Kind == "bbt" || in.Kind == "ovulation_test" || in.Kind == "symptom" {
			replace := ""
			if in.Kind == "symptom" {
				replace = *code
			}
			if err := q.DeleteOwnFertilityDayKind(ctx, store.DeleteOwnFertilityDayKindParams{
				FamilyID: familyID, OwnerID: actor, Kind: in.Kind, EntryDate: in.Date, Code: replace,
			}); err != nil {
				return err
			}
		}
		row, err := q.CreateFertilityEntry(ctx, store.CreateFertilityEntryParams{
			FamilyID: familyID, OwnerMemberID: actor, Visibility: string(in.Visibility), Kind: in.Kind,
			EntryDate: in.Date, Code: code, TempC: temp, NoteSealed: sealed,
		})
		if err != nil {
			return err
		}
		out = Entry{FertilityEntry: row, Note: strings.TrimSpace(in.Note)}
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityEntry, row.ID.String())
	})
	return out, err
}

func List(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, viewer uuid.UUID, today time.Time) ([]Entry, error) {
	var out []Entry
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListFertilityEntriesVisibleToParent(ctx, store.ListFertilityEntriesVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: today.Add(-ListWindow),
		})
		if err != nil {
			return err
		}
		for _, r := range rows {
			e, err := open(key, r)
			if errors.Is(err, crypt.ErrCannotDecrypt) {
				continue // sealed with an earlier ephemeral key; leave it out like the diary does
			}
			if err != nil {
				return err
			}
			out = append(out, e)
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityEntry, "")
	})
	return out, err
}

// Update lets the author change who may read an entry.
func Update(ctx context.Context, pool *pgxpool.Pool, key crypt.Key, familyID, actor, id uuid.UUID, v access.Visibility) (Entry, error) {
	if !validVisibility(v) {
		return Entry{}, ErrNotShare
	}
	var out Entry
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.GetOwnFertilityEntryVisibleToParent(ctx, store.GetOwnFertilityEntryVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor}); errors.Is(err, pgx.ErrNoRows) {
			return ErrNoEntry
		} else if err != nil {
			return err
		}
		row, err := q.UpdateOwnFertilityEntryVisibleToParent(ctx, store.UpdateOwnFertilityEntryVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor, Visibility: string(v)})
		if err != nil {
			return err
		}
		if out, err = open(key, row); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entityEntry, id.String())
	})
	return out, err
}

func Delete(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.DeleteOwnFertilityEntryVisibleToParent(ctx, store.DeleteOwnFertilityEntryVisibleToParentParams{ID: id, FamilyID: familyID, ViewerID: actor})
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNoEntry
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entityEntry, id.String())
	})
}

// Overview is the cycle summary of one parent, from their own period days.
type Overview struct {
	Cycles    []rules.Cycle
	CycleDay  int
	Estimate  rules.Estimate
	Clinician rules.Clinician
}

func ReadOverview(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, born *time.Time, today time.Time) (Overview, error) {
	var out Overview
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		days, err := q.ListOwnPeriodDaysVisibleToParent(ctx, store.ListOwnPeriodDaysVisibleToParentParams{
			FamilyID: familyID, ViewerID: viewer, Since: today.Add(-overviewWindow),
		})
		if err != nil {
			return err
		}
		starts := rules.CycleStarts(days)
		out.Cycles = rules.Cycles(starts)
		if len(out.Cycles) > 7 {
			out.Cycles = out.Cycles[len(out.Cycles)-7:]
		}
		out.Estimate = rules.EstimateFertileWindow(starts, today)
		out.CycleDay = out.Estimate.CycleDay
		var since, bornT time.Time
		s, err := q.GetJourneySettingsVisibleToParent(ctx, store.GetJourneySettingsVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if err == nil && s.TryingSince != nil {
			since = *s.TryingSince
		}
		if born != nil {
			bornT = *born
		}
		out.Clinician = rules.ClinicianAdvice(since, bornT, today)
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityOverview, "")
	})
	return out, err
}

// ChecklistItem is an item with this parent's state and the partner's shared tick.
type ChecklistItem struct {
	Item
	Done        bool
	DoneAt      time.Time
	Visibility  string
	PartnerDone bool
	// PartnerOnly marks an item that is not on this parent's list: the other parent
	// shared the tick, so it is shown but cannot be ticked here.
	PartnerOnly bool
}

type Checklist struct {
	Items         []ChecklistItem
	Done          int
	PartnerShared int
}

func ReadChecklist(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID, role string) (Checklist, error) {
	var out Checklist
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var err error
		out, err = readChecklist(ctx, q, familyID, viewer, role)
		if err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, viewer, access.ActionRead, entityChecklist, "")
	})
	return out, err
}

func readChecklist(ctx context.Context, q *store.Queries, familyID, viewer uuid.UUID, role string) (Checklist, error) {
	ticks, err := q.ListPreconceptionTicksVisibleToParent(ctx, store.ListPreconceptionTicksVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
	if err != nil {
		return Checklist{}, err
	}
	own := map[string]store.PreconceptionTick{}
	theirs := map[string]bool{}
	for _, t := range ticks {
		if t.OwnerMemberID == viewer {
			own[t.ItemKey] = t
		} else {
			theirs[t.ItemKey] = true
		}
	}
	var out Checklist
	for _, it := range Items {
		if !it.Audience.includes(role) {
			if theirs[it.Key] {
				out.Items = append(out.Items, ChecklistItem{Item: it, PartnerDone: true, PartnerOnly: true})
				out.PartnerShared++
			}
			continue
		}
		ci := ChecklistItem{Item: it, PartnerDone: theirs[it.Key]}
		if t, ok := own[it.Key]; ok {
			ci.Done, ci.DoneAt, ci.Visibility = true, t.DoneAt, t.Visibility
			out.Done++
		}
		if ci.PartnerDone {
			out.PartnerShared++
		}
		out.Items = append(out.Items, ci)
	}
	return out, nil
}

// SetTick ticks or unticks one item for the acting parent.
func SetTick(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, role, key string, done bool, v access.Visibility, now time.Time) (Checklist, error) {
	it, ok := Find(key)
	if !ok || !it.Audience.includes(role) {
		return Checklist{}, ErrNoItem
	}
	if !validVisibility(v) {
		return Checklist{}, ErrNotShare
	}
	var out Checklist
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		action := access.ActionDelete
		if done {
			action = access.ActionCreate
			if _, err := q.UpsertPreconceptionTick(ctx, store.UpsertPreconceptionTickParams{
				FamilyID: familyID, OwnerMemberID: actor, Visibility: string(v), ItemKey: key, DoneAt: now,
			}); err != nil {
				return err
			}
		} else if err := q.DeleteOwnPreconceptionTick(ctx, store.DeleteOwnPreconceptionTickParams{FamilyID: familyID, OwnerID: actor, ItemKey: key}); err != nil {
			return err
		}
		var err error
		if out, err = readChecklist(ctx, q, familyID, actor, role); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, action, entityChecklist, key)
	})
	return out, err
}

type Settings struct {
	HideBabyContent    bool
	FertilityTreatment bool
	PreviousLoss       bool
	TryingSince        *time.Time
}

// ReadSettings is not audited: only the owner can read their settings, and
// screens read the hide-baby-content flag on every page.
func ReadSettings(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID) (Settings, error) {
	row, err := store.New(pool).GetJourneySettingsVisibleToParent(ctx, store.GetJourneySettingsVisibleToParentParams{FamilyID: familyID, ViewerID: viewer})
	if errors.Is(err, pgx.ErrNoRows) {
		return Settings{}, nil
	}
	if err != nil {
		return Settings{}, err
	}
	return Settings{row.HideBabyContent, row.FertilityTreatment, row.PreviousLoss, row.TryingSince}, nil
}

func SaveSettings(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in Settings, today, now time.Time) (Settings, error) {
	if in.TryingSince != nil && in.TryingSince.After(today) {
		return Settings{}, Invalid("tryingSince cannot be in the future")
	}
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.UpsertJourneySettings(ctx, store.UpsertJourneySettingsParams{
			FamilyID: familyID, OwnerMemberID: actor, HideBabyContent: in.HideBabyContent, FertilityTreatment: in.FertilityTreatment,
			PreviousLoss: in.PreviousLoss, TryingSince: in.TryingSince, UpdatedAt: now,
		}); err != nil {
			return err
		}
		return access.Audit(ctx, q, familyID, actor, access.ActionUpdate, entitySettings, "")
	})
	return in, err
}
