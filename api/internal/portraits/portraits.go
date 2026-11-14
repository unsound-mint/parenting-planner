// Package portraits stores the monthly portrait flipbook: a child's portrait
// by age in months and the bump by pregnancy week. Photos are decoded and
// re-encoded here, so the database never holds what the client sent: no EXIF,
// no location, no other metadata.
package portraits

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png" // registers the PNG decoder for image.Decode
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entity = "portrait"

// MaxBytes caps an upload: a 1600 px JPEG from the browser is far below it.
const MaxBytes = 1536 << 10

// MaxSide caps the decoded size, so a small but huge-canvas PNG cannot make
// the server allocate gigabytes.
const MaxSide = 4096

const jpegQuality = 85

var (
	// ErrType: the bytes are not a JPEG or a PNG, whatever the header said.
	ErrType = errors.New("not a jpeg or png")
	// ErrUnreadable: the bytes start like an image but do not decode.
	ErrUnreadable = errors.New("image does not decode")
	// ErrDimensions: wider or taller than MaxSide.
	ErrDimensions = errors.New("image too large")
	// ErrNoChild: childId is not a child of this family.
	ErrNoChild = errors.New("no such child")
)

// Person is who reads: a parent, or a caregiver with permissions.
type Person struct {
	ID          uuid.UUID
	Role        string
	Permissions []string
}

func (p Person) IsParent() bool { return p.Role == "mother" || p.Role == "partner" }

// CanSee reports whether p may see a child's portraits (child) or the bump
// (!child): parents always, a caregiver with baby_passport for children and
// with pregnancy_updates for the bump. ListPortraits and GetPortraitImage
// apply the same rule in SQL through seesChildren and seesBump.
func (p Person) CanSee(child bool) bool {
	if p.IsParent() {
		return true
	}
	if child {
		return slices.Contains(p.Permissions, "baby_passport")
	}
	return slices.Contains(p.Permissions, "pregnancy_updates")
}

// CanSeeAny is false for a caregiver with neither permission (403).
func (p Person) CanSeeAny() bool { return p.CanSee(true) || p.CanSee(false) }

// Slot is where a portrait goes: a child and an age in months, or a
// pregnancy week (ChildID nil).
type Slot struct {
	ChildID *uuid.UUID
	Month   *int
	Week    *int
}

// Valid is true for exactly one of the two shapes.
func (s Slot) Valid() bool {
	return (s.ChildID != nil && s.Month != nil && s.Week == nil) || (s.ChildID == nil && s.Week != nil && s.Month == nil)
}

// Photo is an image after Sanitize: always a JPEG with no metadata.
type Photo struct {
	JPEG          []byte
	Width, Height int
}

// Sanitize decodes a JPEG or PNG (the format comes from the bytes) and
// re-encodes it as a baseline JPEG. Only pixels survive: EXIF, GPS, XMP, ICC
// and comments are dropped because the encoder writes none of them.
// Transparent PNG pixels are laid on the app's paper colour.
func Sanitize(raw []byte) (Photo, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		return Photo{}, ErrType
	}
	if format != "jpeg" && format != "png" {
		return Photo{}, ErrType
	}
	if cfg.Width < 1 || cfg.Height < 1 || cfg.Width > MaxSide || cfg.Height > MaxSide {
		return Photo{}, ErrDimensions
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return Photo{}, ErrUnreadable
	}
	b := img.Bounds()
	flat := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(flat, flat.Bounds(), image.NewUniform(color.RGBA{0xFB, 0xF7, 0xF0, 0xFF}), image.Point{}, draw.Src)
	draw.Draw(flat, flat.Bounds(), img, b.Min, draw.Over)
	var out bytes.Buffer
	if err := jpeg.Encode(&out, flat, &jpeg.Options{Quality: jpegQuality}); err != nil {
		return Photo{}, err
	}
	return Photo{JPEG: out.Bytes(), Width: b.Dx(), Height: b.Dy()}, nil
}

// Portrait is one row without its image.
type Portrait struct {
	ID         uuid.UUID
	ChildID    *uuid.UUID
	Month      *int
	Week       *int
	Kind       string
	UploadedBy *uuid.UUID
	Width      *int
	Height     *int
	CreatedAt  time.Time
}

func fromRow(id uuid.UUID, child uuid.NullUUID, month, week pgtype.Int2, kind string, by uuid.NullUUID, w, h pgtype.Int4, at time.Time) Portrait {
	p := Portrait{ID: id, Kind: kind, CreatedAt: at}
	if child.Valid {
		p.ChildID = &child.UUID
	}
	if by.Valid {
		p.UploadedBy = &by.UUID
	}
	p.Month, p.Week = int2(month), int2(week)
	p.Width, p.Height = int4(w), int4(h)
	return p
}

func int2(v pgtype.Int2) *int {
	if !v.Valid {
		return nil
	}
	n := int(v.Int16)
	return &n
}

func int4(v pgtype.Int4) *int {
	if !v.Valid {
		return nil
	}
	n := int(v.Int32)
	return &n
}

func pgInt2(v *int) pgtype.Int2 {
	if v == nil {
		return pgtype.Int2{}
	}
	return pgtype.Int2{Int16: int16(*v), Valid: true}
}

func nullUUID(v *uuid.UUID) uuid.NullUUID {
	if v == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *v, Valid: true}
}

// Create stores a parent's photo in its slot, replacing whatever was there.
func Create(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, slot Slot, photo Photo, now time.Time) (Portrait, error) {
	var out Portrait
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if slot.ChildID != nil {
			ok, err := q.ChildInFamily(ctx, store.ChildInFamilyParams{ChildID: *slot.ChildID, FamilyID: familyID})
			if err != nil {
				return err
			}
			if !ok {
				return ErrNoChild
			}
		}
		if err := q.DeletePortraitSlot(ctx, store.DeletePortraitSlotParams{
			FamilyID: familyID, ChildID: nullUUID(slot.ChildID), Month: pgInt2(slot.Month), Week: pgInt2(slot.Week),
		}); err != nil {
			return err
		}
		r, err := q.CreatePortrait(ctx, store.CreatePortraitParams{
			FamilyID: familyID, ChildID: nullUUID(slot.ChildID), Month: pgInt2(slot.Month), Week: pgInt2(slot.Week),
			Kind: "photo", UploaderMemberID: uuid.NullUUID{UUID: actor, Valid: true},
			Width: pgtype.Int4{Int32: int32(photo.Width), Valid: true}, Height: pgtype.Int4{Int32: int32(photo.Height), Valid: true},
			Image: photo.JPEG, CreatedAt: now,
		})
		if err != nil {
			return err
		}
		out = fromRow(r.ID, r.ChildID, r.Month, r.Week, r.Kind, r.UploaderMemberID, r.Width, r.Height, r.CreatedAt)
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entity, r.ID.String())
	})
	return out, err
}

// List returns what the viewer may see, newest moment first. A caregiver's
// read is audited, as with the care log; a parent's own family album is not.
func List(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, viewer Person) ([]Portrait, error) {
	var out []Portrait
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		rows, err := q.ListPortraits(ctx, store.ListPortraitsParams{FamilyID: familyID, SeesChildren: viewer.CanSee(true), SeesBump: viewer.CanSee(false)})
		if err != nil {
			return err
		}
		out = make([]Portrait, 0, len(rows))
		for _, r := range rows {
			out = append(out, fromRow(r.ID, r.ChildID, r.Month, r.Week, r.Kind, r.UploaderMemberID, r.Width, r.Height, r.CreatedAt))
		}
		if viewer.IsParent() {
			return nil
		}
		return access.Audit(ctx, q, familyID, viewer.ID, access.ActionRead, entity, "")
	})
	return out, err
}

// Image returns a photo's JPEG, or pgx.ErrNoRows when the viewer may not see
// it, it is an illustration, or it is not in the family.
func Image(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, viewer Person, id uuid.UUID) ([]byte, error) {
	var out []byte
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		r, err := q.GetPortraitImage(ctx, store.GetPortraitImageParams{
			ID: id, FamilyID: familyID, SeesChildren: viewer.CanSee(true), SeesBump: viewer.CanSee(false),
		})
		if err != nil {
			return err
		}
		out = r.Image
		if viewer.IsParent() {
			return nil
		}
		return access.Audit(ctx, q, familyID, viewer.ID, access.ActionRead, entity, id.String())
	})
	return out, err
}

// Delete removes one portrait; false when the id is not in the family.
func Delete(ctx context.Context, pool *pgxpool.Pool, familyID, actor, id uuid.UUID) (bool, error) {
	var found bool
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.DeletePortrait(ctx, store.DeletePortraitParams{ID: id, FamilyID: familyID})
		if err != nil || n == 0 {
			return err
		}
		found = true
		return access.Audit(ctx, q, familyID, actor, access.ActionDelete, entity, id.String())
	})
	return found, err
}

// DropPhotos deletes a family's uploaded photos (the drawings stay). It runs
// when a browser leaves the family for a new demo: the old copy is no longer
// reachable from that browser, so its photos must not outlive the demo.
func DropPhotos(ctx context.Context, q *store.Queries, familyID uuid.UUID) error {
	_, err := q.DeleteFamilyPhotos(ctx, familyID)
	return err
}
