// Package birth answers "where do we go and what do we bring when labour
// starts" and sends the labour alert to the other parent. Hospital details and
// the document list are not health data; the alert carries no health text.
package birth

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/live"
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
	docs, err := documentState(ctx, q, familyID, true)
	if err != nil {
		return Plan{}, err
	}
	out := Plan{Hospital: bp, MapsURL: MapsURL(bp.HospitalAddress), Docs: docs}
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
			if err := live.Publish(ctx, q, familyID, live.Event{Kind: live.Notification, EntityID: sender.String(), Actor: sender, Audience: []uuid.UUID{m.ID}}, now); err != nil {
				return err
			}
			sent = true
		}
		return nil
	})
	return sent, err
}

// AppointmentLogistics uses the configured drive time only when the visit is
// at the birth hospital. Other locations have no estimate.
func AppointmentLogistics(ctx context.Context, pool *pgxpool.Pool, family uuid.UUID, location *string) ([]Document, *int, error) {
	q := store.New(pool)
	docs, err := documentState(ctx, q, family, false)
	if err != nil || location == nil {
		return docs, nil, err
	}
	plan, err := q.GetBirthPlan(ctx, family)
	if errors.Is(err, pgx.ErrNoRows) {
		return docs, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	if !plan.TravelMinutes.Valid || !strings.EqualFold(strings.TrimSpace(*location), strings.TrimSpace(plan.HospitalAddress)) {
		return docs, nil, nil
	}
	minutes := int(plan.TravelMinutes.Int32)
	return docs, &minutes, nil
}

func documentState(ctx context.Context, q *store.Queries, family uuid.UUID, forBirth bool) ([]Document, error) {
	items := append([]Document(nil), catalog...)
	if !forBirth {
		items = []Document{
			catalog[0],
			{Title: "Insurance network confirmation", Detail: "Bring confirmation if you checked that the clinic is in network."},
		}
	}
	tasks, err := q.ListTasks(ctx, store.ListTasksParams{FamilyID: family})
	if err != nil {
		return nil, err
	}
	for i := range items {
		for _, task := range tasks {
			title := strings.ToLower(task.Title)
			match := false
			switch i {
			case 0:
				match = task.Kind == "hospital_bag" && title == "photo id and insurance card"
			case 1:
				if task.Kind == "paperwork" {
					if forBirth {
						match = strings.Contains(title, "pre-registration") || strings.Contains(title, "preregister")
					} else {
						match = strings.Contains(title, "in network") || strings.Contains(title, "in-network")
					}
				}
			}
			if match {
				items[i].TaskID = &task.ID
				items[i].Ready = task.Done
				break
			}
		}
	}
	return items, nil
}
