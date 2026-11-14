// Package supplies is what the family keeps at home for the baby (diapers,
// wipes, formula, medicines, clothes) and the shared shopping list.
//
// Not sensitive per-parent data: parents see everything, and a caregiver with
// the care_log permission may read it and tick the shopping list. A caregiver's
// reads and changes are written to audit_log, like the care log.
package supplies

import (
	"context"
	"errors"
	"math"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const (
	entityItem     = "supply_item"
	entityShopping = "shopping_item"
)

const (
	// EstimateWindow is how far back the care log is read to estimate use.
	EstimateWindow = 7 * 24 * time.Hour
	// MinEvents is how many logged events an estimate needs.
	MinEvents = 3
	// LowDays: at or under this many days left an item counts as low.
	LowDays = 3
	// DoneVisible is how long a ticked row stays on the list.
	DoneVisible = 3 * 24 * time.Hour
)

var (
	ErrNoItem     = errors.New("no such supply item")
	ErrNoShopping = errors.New("no such shopping row")
)

// Person is whoever acts: a parent or a caregiver.
type Person struct {
	ID          uuid.UUID
	Role        string
	Permissions []string
}

func (p Person) IsParent() bool { return p.Role == "mother" || p.Role == "partner" }

// CanUse: parents always, a caregiver with care_log.
func (p Person) CanUse() bool { return p.IsParent() || slices.Contains(p.Permissions, "care_log") }

func audit(ctx context.Context, q *store.Queries, familyID uuid.UUID, p Person, action, ent, id string) error {
	if p.IsParent() {
		return nil
	}
	return access.Audit(ctx, q, familyID, p.ID, action, ent, id)
}

// Item is a stored item with its derived status.
type Item struct {
	store.SupplyItem
	Status         string // stocked, running_low, empty
	DaysLeft       *int
	UsagePerDay    *float64
	OnShoppingList bool
}

type Size struct {
	ChildID   uuid.UUID
	ChildName string
	AgeMonths int
	WeightKg  *float64
	Clothing  string
	Diaper    string
	Basis     string
}

type Overview struct {
	Items    []Item
	Shopping []store.ShoppingItem
	Sizes    *Size
}

// usage counts what the care log of the window says about each tracked kind.
type usage struct {
	diapers, formulaFeeds int
	spanDays              float64
}

func loadUsage(ctx context.Context, q *store.Queries, familyID uuid.UUID, now time.Time) (usage, error) {
	rows, err := q.ListCareLogEntries(ctx, store.ListCareLogEntriesParams{FamilyID: familyID, Since: now.Add(-EstimateWindow)})
	if err != nil {
		return usage{}, err
	}
	var u usage
	first := now
	for _, r := range rows {
		if r.StartedAt.Before(first) {
			first = r.StartedAt
		}
		if r.Kind == "diaper" {
			u.diapers++
		}
		if r.Kind == "feed" && r.FeedMethod != nil && *r.FeedMethod == "bottle_formula" {
			u.formulaFeeds++
		}
	}
	// The log is only as long as it has been kept: a day at least, a week at most.
	u.spanDays = math.Min(7, math.Max(1, now.Sub(first).Hours()/24))
	return u, nil
}

// estimate is the units per day for an item, when the care log supports one.
func (u usage) estimate(it store.SupplyItem) (float64, bool) {
	var n int
	switch it.Category {
	case "diapers", "wipes":
		n = u.diapers
	case "formula":
		n = u.formulaFeeds
	default:
		return 0, false
	}
	if n < MinEvents {
		return 0, false
	}
	return float64(n) / u.spanDays * float64(it.PerUse), true
}

// Derive computes status and estimate for one item.
func derive(it store.SupplyItem, u usage, onList bool) Item {
	out := Item{SupplyItem: it, Status: "stocked", OnShoppingList: onList}
	if per, ok := u.estimate(it); ok && per > 0 {
		d := int(math.Floor(float64(it.Quantity) / per))
		out.DaysLeft, out.UsagePerDay = &d, &per
	}
	switch {
	case it.Quantity == 0:
		out.Status = "empty"
	case it.Quantity <= it.LowAt, out.DaysLeft != nil && *out.DaysLeft <= LowDays:
		out.Status = "running_low"
	}
	return out
}

func rank(s string) int {
	switch s {
	case "empty":
		return 0
	case "running_low":
		return 1
	}
	return 2
}

func Get(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, now time.Time) (Overview, error) {
	var out Overview
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		items, err := q.ListSupplyItems(ctx, familyID)
		if err != nil {
			return err
		}
		shopping, err := q.ListShoppingItems(ctx, store.ListShoppingItemsParams{FamilyID: familyID, DoneSince: pgtype.Timestamptz{Time: now.Add(-DoneVisible), Valid: true}})
		if err != nil {
			return err
		}
		u, err := loadUsage(ctx, q, familyID, now)
		if err != nil {
			return err
		}
		onList := map[uuid.UUID]bool{}
		for _, s := range shopping {
			if s.SupplyItemID.Valid && !s.DoneAt.Valid {
				onList[s.SupplyItemID.UUID] = true
			}
		}
		for _, it := range items {
			out.Items = append(out.Items, derive(it, u, onList[it.ID]))
		}
		slices.SortStableFunc(out.Items, func(a, b Item) int { return rank(a.Status) - rank(b.Status) })
		out.Shopping = shopping
		if out.Sizes, err = sizesFor(ctx, q, familyID, now); err != nil {
			return err
		}
		return audit(ctx, q, familyID, p, access.ActionRead, entityItem, "")
	})
	return out, err
}

func sizesFor(ctx context.Context, q *store.Queries, familyID uuid.UUID, now time.Time) (*Size, error) {
	kids, err := q.ListChildren(ctx, familyID)
	if err != nil || len(kids) == 0 {
		return nil, err
	}
	kid := kids[len(kids)-1]
	months := int(now.Sub(kid.BirthDate).Hours() / 24 / 30.4375)
	s := &Size{ChildID: kid.ID, ChildName: kid.Name, AgeMonths: months}
	var kg float64
	g, err := q.LatestGrowthMeasurement(ctx, store.LatestGrowthMeasurementParams{FamilyID: familyID, ChildID: kid.ID})
	switch {
	case err == nil:
		kg = g.WeightKg
		s.WeightKg = &kg
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}
	s.Clothing, s.Diaper, s.Basis = Suggest(months, kg)
	return s, nil
}

type NewItem struct {
	Name, Category string
	Quantity       int32
	Unit           string
	LowAt          int32
	PerUse         int16
	Size           *string
	ExpiresOn      *time.Time
}

func CreateItem(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, in NewItem) (store.SupplyItem, error) {
	var out store.SupplyItem
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		it, err := q.CreateSupplyItem(ctx, store.CreateSupplyItemParams{
			FamilyID: familyID, Name: in.Name, Category: in.Category, Quantity: in.Quantity, Unit: in.Unit,
			LowAt: in.LowAt, PerUse: in.PerUse, Size: in.Size, ExpiresOn: in.ExpiresOn,
		})
		out = it
		return err
	})
	return out, err
}

// UpdateItem returns the derived item so the caller can show status at once.
func UpdateItem(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID, in NewItem, now time.Time) (Item, error) {
	var out Item
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		it, err := q.UpdateSupplyItem(ctx, store.UpdateSupplyItemParams{
			ID: id, FamilyID: familyID, Name: in.Name, Quantity: in.Quantity, Unit: in.Unit, LowAt: in.LowAt,
			PerUse: in.PerUse, Size: in.Size, ExpiresOn: in.ExpiresOn,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoItem
		}
		if err != nil {
			return err
		}
		return deriveOne(ctx, q, familyID, it, now, &out)
	})
	return out, err
}

func deriveOne(ctx context.Context, q *store.Queries, familyID uuid.UUID, it store.SupplyItem, now time.Time, out *Item) error {
	u, err := loadUsage(ctx, q, familyID, now)
	if err != nil {
		return err
	}
	_, err = q.GetOpenShoppingItemForSupply(ctx, store.GetOpenShoppingItemForSupplyParams{FamilyID: familyID, SupplyItemID: uuid.NullUUID{UUID: it.ID, Valid: true}})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	*out = derive(it, u, err == nil)
	return nil
}

// DeriveCreated is the derived view of a freshly created item.
func DeriveCreated(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, it store.SupplyItem, now time.Time) (Item, error) {
	var out Item
	err := deriveOne(ctx, store.New(pool), familyID, it, now, &out)
	return out, err
}

func DeleteItem(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID) error {
	n, err := store.New(pool).DeleteSupplyItem(ctx, store.DeleteSupplyItemParams{ID: id, FamilyID: familyID})
	if err == nil && n == 0 {
		return ErrNoItem
	}
	return err
}

type NewShopping struct {
	Name         string
	SupplyItemID *uuid.UUID
	Restock      *int32
}

// CreateShopping adds a row. A second open row for the same item returns the first.
func CreateShopping(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, in NewShopping) (store.ShoppingItem, error) {
	var out store.ShoppingItem
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		var link uuid.NullUUID
		if in.SupplyItemID != nil {
			if _, err := q.GetSupplyItem(ctx, store.GetSupplyItemParams{ID: *in.SupplyItemID, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
				return ErrNoItem
			} else if err != nil {
				return err
			}
			link = uuid.NullUUID{UUID: *in.SupplyItemID, Valid: true}
			if ex, err := q.GetOpenShoppingItemForSupply(ctx, store.GetOpenShoppingItemForSupplyParams{FamilyID: familyID, SupplyItemID: link}); err == nil {
				out = ex
				return nil
			} else if !errors.Is(err, pgx.ErrNoRows) {
				return err
			}
		}
		var restock pgtype.Int4
		if in.Restock != nil {
			restock = pgtype.Int4{Int32: *in.Restock, Valid: true}
		}
		s, err := q.CreateShoppingItem(ctx, store.CreateShoppingItemParams{
			FamilyID: familyID, Name: in.Name, SupplyItemID: link, RestockQuantity: restock, AddedByMemberID: p.ID,
		})
		if err != nil {
			return err
		}
		out = s
		return audit(ctx, q, familyID, p, access.ActionCreate, entityShopping, s.ID.String())
	})
	return out, err
}

// SetDone ticks or unticks a row. Ticking a row linked to an item with a
// restock quantity adds it to the item once; unticking takes it back.
func SetDone(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, p Person, id uuid.UUID, done bool, now time.Time) (store.ShoppingItem, error) {
	var out store.ShoppingItem
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		cur, err := q.GetShoppingItemForUpdate(ctx, store.GetShoppingItemForUpdateParams{ID: id, FamilyID: familyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoShopping
		}
		if err != nil {
			return err
		}
		out = cur
		if cur.DoneAt.Valid == done {
			return nil // already in that state
		}
		var at pgtype.Timestamptz
		var by uuid.NullUUID
		sign := int32(-1)
		if done {
			at, by, sign = pgtype.Timestamptz{Time: now, Valid: true}, uuid.NullUUID{UUID: p.ID, Valid: true}, 1
		}
		if out, err = q.SetShoppingItemDone(ctx, store.SetShoppingItemDoneParams{ID: id, FamilyID: familyID, DoneAt: at, DoneBy: by}); err != nil {
			return err
		}
		if cur.SupplyItemID.Valid && cur.RestockQuantity.Valid {
			if err := q.AddSupplyQuantity(ctx, store.AddSupplyQuantityParams{ID: cur.SupplyItemID.UUID, FamilyID: familyID, Amount: sign * cur.RestockQuantity.Int32}); err != nil {
				return err
			}
		}
		return audit(ctx, q, familyID, p, access.ActionUpdate, entityShopping, id.String())
	})
	return out, err
}

func DeleteShopping(ctx context.Context, pool *pgxpool.Pool, familyID, id uuid.UUID) error {
	n, err := store.New(pool).DeleteShoppingItem(ctx, store.DeleteShoppingItemParams{ID: id, FamilyID: familyID})
	if err == nil && n == 0 {
		return ErrNoShopping
	}
	return err
}

// SetEssentialsOnly stores a parent's own "Essentials only" setting.
func SetEssentialsOnly(ctx context.Context, pool *pgxpool.Pool, familyID, member uuid.UUID, on bool) error {
	_, err := store.New(pool).SetMemberEssentialsOnly(ctx, store.SetMemberEssentialsOnlyParams{ID: member, FamilyID: familyID, EssentialsOnly: on})
	return err
}
