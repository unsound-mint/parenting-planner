// Package offers owns partner offers: sponsored cards from invented brands
// that parents see in their own "Partner offer" block, and the admin panel
// that edits them.
//
// Offers are not health data and are never targeted with it: an offer matches
// on the family's stage and the parent's role only. Clicks are stored with the
// offer, the family and the time, never the person, so the admin sees
// aggregate counts only.
//
// There is no admin login. Every demo family has its own copy of the offers,
// so a visitor's edits never reach another visitor.
package offers

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// MaxShown is how many offers a parent sees at most.
const MaxShown = 3

// ErrNotFound means the offer is not in this family.
var ErrNotFound = errors.New("no such offer in this family")

// Offer is an offer with its click count. Clicks is only filled for the admin.
type Offer struct {
	store.PartnerOffer
	Clicks int
}

// ForParent returns the active offers for the family's stage and the parent's
// role, newest first, at most MaxShown. Nothing else about the family is read.
func ForParent(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, stage, role string) ([]store.PartnerOffer, error) {
	return store.New(pool).ListPartnerOffersForParent(ctx, store.ListPartnerOffersForParentParams{
		FamilyID: familyID, Stage: stage, Role: role, MaxItems: MaxShown,
	})
}

// Click counts one click on an offer of this family. ErrNotFound for an
// offer in another family or none at all.
func Click(ctx context.Context, pool *pgxpool.Pool, familyID, offerID uuid.UUID) error {
	n, err := store.New(pool).CreatePartnerOfferClick(ctx, store.CreatePartnerOfferClickParams{OfferID: offerID, FamilyID: familyID})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// All returns every offer of the family, active or not, newest first, with click counts.
func All(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID) ([]Offer, error) {
	rows, err := store.New(pool).ListAllPartnerOffers(ctx, familyID)
	if err != nil {
		return nil, err
	}
	out := make([]Offer, 0, len(rows))
	for _, r := range rows {
		out = append(out, Offer{PartnerOffer: store.PartnerOffer{
			ID: r.ID, FamilyID: r.FamilyID, PartnerName: r.PartnerName, Title: r.Title, Detail: r.Detail, Url: r.Url,
			Stages: r.Stages, Audience: r.Audience, Active: r.Active, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		}, Clicks: int(r.Clicks)})
	}
	return out, nil
}

type NewOffer struct {
	PartnerName, Title, Detail, URL string
	Stages, Audience                []string
	Active                          bool
}

// Create adds an offer to the family. now is the family's clock.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, in NewOffer, now time.Time) (store.PartnerOffer, error) {
	return create(ctx, store.New(pool), familyID, in, now)
}

func create(ctx context.Context, q *store.Queries, familyID uuid.UUID, in NewOffer, now time.Time) (store.PartnerOffer, error) {
	return q.CreatePartnerOffer(ctx, store.CreatePartnerOfferParams{
		FamilyID: familyID, PartnerName: in.PartnerName, Title: in.Title, Detail: in.Detail, Url: in.URL,
		Stages: in.Stages, Audience: in.Audience, Active: in.Active, CreatedAt: now,
	})
}

// Change holds the fields to update; nil leaves a field as it is.
type Change struct {
	PartnerName, Title, Detail, URL *string
	Stages, Audience                []string
	Active                          *bool
}

// Update changes an offer of this family and returns it with its click count.
func Update(ctx context.Context, pool *pgxpool.Pool, familyID, offerID uuid.UUID, c Change, now time.Time) (Offer, error) {
	var out Offer
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		active := pgtype.Bool{}
		if c.Active != nil {
			active = pgtype.Bool{Bool: *c.Active, Valid: true}
		}
		o, err := q.UpdatePartnerOffer(ctx, store.UpdatePartnerOfferParams{
			PartnerName: c.PartnerName, Title: c.Title, Detail: c.Detail, Url: c.URL,
			Stages: c.Stages, Audience: c.Audience, Active: active, UpdatedAt: now,
			ID: offerID, FamilyID: familyID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		n, err := q.GetPartnerOfferClicks(ctx, store.GetPartnerOfferClicksParams{OfferID: offerID, FamilyID: familyID})
		if err != nil {
			return err
		}
		out = Offer{PartnerOffer: o, Clicks: int(n)}
		return nil
	})
	return out, err
}

// Seed gives a new demo family its own copy of the invented partner offers.
// Every stage has at least one; one is for the partner only and one is
// switched off, so the targeting and the admin switch show in the demo.
func Seed(ctx context.Context, q *store.Queries, familyID uuid.UUID, now time.Time) error {
	for i, o := range seedOffers {
		// One second apart so "newest first" keeps this order.
		if _, err := create(ctx, q, familyID, o, now.Add(time.Duration(len(seedOffers)-i)*time.Second)); err != nil {
			return err
		}
	}
	return nil
}

var (
	both    = []string{"mother", "partner"}
	partner = []string{"partner"}
)

// Brands, products and links are invented; example.com never resolves to a shop,
// so the web labels these "Sample partner offer" and does not render the link.
var seedOffers = []NewOffer{
	{PartnerName: "Mossy Diapers", Title: "First box of diapers, half price", Detail: "Soft, fragrance-free diapers delivered before the due date.",
		URL: "https://example.com/mossy-diapers", Stages: []string{"pregnancy", "postpartum", "infant"}, Audience: both, Active: true},
	{PartnerName: "Harbor Birth Classes", Title: "Online childbirth class, first session free", Detail: "Evening sessions for two. Recordings stay for 30 days.",
		URL: "https://example.com/harbor-classes", Stages: []string{"pregnancy"}, Audience: partner, Active: true},
	{PartnerName: "Little Lantern", Title: "Night light and white noise, one device", Detail: "A dim amber light that is easy on tired eyes at 3 am.",
		URL: "https://example.com/little-lantern", Stages: []string{"pregnancy", "postpartum", "infant", "toddler"}, Audience: both, Active: true},
	{PartnerName: "Willow Planners", Title: "A printed family budget planner", Detail: "Twelve months of pages for the costs of a growing family.",
		URL: "https://example.com/willow-planners", Stages: []string{"planning", "trying", "pregnancy"}, Audience: both, Active: true},
	{PartnerName: "Bramble Books", Title: "Three picture books a month, first box free", Detail: "Chosen by age, with a short note for whoever reads aloud.",
		URL: "https://example.com/bramble-books", Stages: []string{"toddler", "preschool", "school_age"}, Audience: both, Active: true},
	{PartnerName: "Pebble Rides", Title: "Car seat check at home, 20% off", Detail: "A certified technician checks the fit in your own car.",
		URL: "https://example.com/pebble-rides", Stages: []string{"postpartum", "infant", "toddler", "preschool"}, Audience: partner, Active: true},
	{PartnerName: "Fern & Co", Title: "Meal kits for the first month home", Detail: "Ten simple dinners that reheat in minutes.",
		URL: "https://example.com/fern-meals", Stages: []string{"postpartum"}, Audience: both, Active: false},
}
