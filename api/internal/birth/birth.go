// Package birth answers "where do we go and what do we bring when labour
// starts" and sends the labour alert to the other parent. Hospital details and
// the document list are not health data; the alert carries no health text.
package birth

import (
	"context"
	"errors"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/notify"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	// ErrNoPlan: the family has no birth plan, or is in pregnancy loss support.
	ErrNoPlan = errors.New("no birth plan")
)

// AlertWindow is the shortest time between two labour alerts of one family.
const AlertWindow = 10 * time.Minute

type Contact struct {
	Label    string
	Name     string
	Phone    string
	MemberID *uuid.UUID
}

// Document is something to bring. TaskID and Ready follow the paperwork task
// behind it when there is one.
type Document struct {
	Title  string
	Detail string
	TaskID *uuid.UUID
	Ready  bool
}

type Plan struct {
	Hospital store.BirthPlan
	MapsURL  string
	Contacts []Contact
	Docs     []Document
}

// catalog is what to bring to the birth. Items are about paperwork, not health.
var catalog = []Document{
	{Title: "Insurance card and photo ID", Detail: "Bring both to the front desk."},
	{Title: "Hospital pre-registration confirmation", Detail: "Complete pre-registration with the hospital before the due date."},
}

// MapsURL opens the route in the maps app (Google Maps directions link).
func MapsURL(address string) string {
	return "https://www.google.com/maps/dir/?api=1&destination=" + url.QueryEscape(address)
}

// inLoss reports whether the family is in pregnancy loss support.
func inLoss(f store.Family) bool { return f.PregnancyLossRecordedAt.Valid }

// Get builds the plan for the acting parent. The contacts are the hospital desk,
// the family's obstetrician and the other parent, in the order to call them.
func Get(ctx context.Context, pool *pgxpool.Pool, familyID, viewer uuid.UUID) (Plan, error) {
	q := store.New(pool)
	fam, err := q.GetFamily(ctx, familyID)
	if err != nil {
		return Plan{}, err
	}
	if inLoss(fam) {
		return Plan{}, ErrNoPlan
	}
	bp, err := q.GetBirthPlan(ctx, familyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Plan{}, ErrNoPlan
	}
	if err != nil {
		return Plan{}, err
	}
	out := Plan{Hospital: bp, MapsURL: MapsURL(bp.HospitalAddress), Docs: append([]Document(nil), catalog...)}
	if bp.DeskPhone != nil {
		out.Contacts = append(out.Contacts, Contact{Label: "Labour and delivery desk", Name: bp.HospitalName, Phone: *bp.DeskPhone})
	}
	team, err := q.ListCareTeam(ctx, familyID)
	if err != nil {
		return Plan{}, err
	}
	for _, c := range team {
		if c.Role == "obgyn" && c.Phone != nil {
			out.Contacts = append(out.Contacts, Contact{Label: "Your OB", Name: c.Name, Phone: *c.Phone})
			break
		}
	}
	members, err := q.ListMembers(ctx, familyID)
	if err != nil {
		return Plan{}, err
	}
	for _, m := range members {
		if m.ID != viewer && m.Phone != nil {
			id := m.ID
			out.Contacts = append(out.Contacts, Contact{Label: "Your partner", Name: m.DisplayName, Phone: *m.Phone, MemberID: &id})
		}
	}
	return out, nil
}

// SendAlert tells the other parent that labour has started: one notification and no
// health text. At most one alert per family per ten minutes: a second tap in the
// window is accepted and sends nothing. It reports whether a notification was sent.
func SendAlert(ctx context.Context, pool *pgxpool.Pool, familyID, sender uuid.UUID, now time.Time) (bool, error) {
	var sent bool
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		fam, err := q.GetFamily(ctx, familyID)
		if err != nil {
			return err
		}
		if inLoss(fam) {
			return ErrNoPlan
		}
		if err := q.LockLabourAlerts(ctx, familyID.String()); err != nil {
			return err
		}
		recent, err := q.LabourAlertSince(ctx, store.LabourAlertSinceParams{FamilyID: familyID, Since: now.Add(-AlertWindow)})
		if err != nil {
			return err
		}
		if recent {
			return nil
		}
		members, err := q.ListMembers(ctx, familyID)
		if err != nil {
			return err
		}
		var name string
		for _, m := range members {
			if m.ID == sender {
				name = m.DisplayName
			}
		}
		for _, m := range members {
			if m.ID == sender {
				continue
			}
			if err := notify.Send(ctx, q, notify.Notification{
				FamilyID: familyID, RecipientID: m.ID, Kind: notify.LabourStarted, EntityID: sender.String(), ActorID: &sender,
				Title: name + " says labour has started", At: now,
			}); err != nil {
				return err
			}
			sent = true
		}
		return nil
	})
	return sent, err
}
