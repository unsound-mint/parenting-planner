package loadmap

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
	"github.com/unsound-mint/parenting-planner/api/internal/tasks"
)

func TestAreaOfTask(t *testing.T) {
	for title, want := range map[string]string{
		"Book the 28-week checkup":               Appointments,
		"Call the clinic about the glucose test": Appointments,
		"Pick a pediatrician":                    Appointments,
		"Buy newborn diapers and wipes":          Shopping,
		"Order the crib":                         Shopping,
		"Book the birth class":                   Learning,
		"Call the insurer about the coverage":    Paperwork,
		"Install the car seat":                   Planning,
		"Transform the spare room":               Planning, // "form" inside a word is not paperwork
	} {
		if got := AreaOfTask(store.Task{Kind: "task", Title: title}); got != want {
			t.Errorf("%q: area %s, want %s", title, got, want)
		}
	}
	if AreaOfTask(store.Task{Kind: "hospital_bag", Title: "Buy a robe"}) != HospitalBag || AreaOfTask(store.Task{Kind: "paperwork", Title: "Visit"}) != Paperwork {
		t.Error("bag and paperwork are told apart by kind")
	}
}

func TestBuildCountsOwnedAndStartedAndOffers(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	me, other := uuid.New(), uuid.New()
	task := func(title string, owner, creator uuid.UUID, mod func(*store.Task)) tasks.Item {
		tk := store.Task{ID: uuid.New(), Kind: "task", Title: title, AssigneeMemberID: owner, CreatedByMemberID: creator}
		if mod != nil {
			mod(&tk)
		}
		return tasks.Item{Task: tk}
	}
	in := Input{Now: now, Actor: me, Tasks: []tasks.Item{
		task("Book a visit", me, me, nil),
		task("Book a checkup", me, me, func(t *store.Task) { t.PendingAssigneeMemberID = uuid.NullUUID{UUID: other, Valid: true} }),
		task("Book a doctor", other, me, func(t *store.Task) { t.PendingAssigneeMemberID = uuid.NullUUID{UUID: me, Valid: true} }),
		task("Book a scan", me, me, func(t *store.Task) {
			t.Done, t.DoneAt = true, pgtype.Timestamptz{Time: now.AddDate(0, 0, -3), Valid: true}
		}),
		task("Book an old visit", me, me, func(t *store.Task) {
			t.Done, t.DoneAt = true, pgtype.Timestamptz{Time: now.AddDate(0, 0, -20), Valid: true}
		}),
	}}
	got := Build(in)
	if len(got) != 1 || got[0].Key != Appointments {
		t.Fatalf("areas = %+v", got)
	}
	a := got[0]
	// Done 3 days ago counts; done 20 days ago does not.
	if a.Owned[0].MemberID != me || a.Owned[0].Count != 3 || a.Owned[1].Count != 1 {
		t.Errorf("owned = %+v", a.Owned)
	}
	if a.Started[0].MemberID != me || a.Started[0].Count != 4 {
		t.Errorf("started = %+v", a.Started)
	}
	if len(a.Handover) != 1 || len(a.OfferedByMe) != 1 || len(a.OfferedToMe) != 1 {
		t.Errorf("handover %d, offered by me %d, to me %d", len(a.Handover), len(a.OfferedByMe), len(a.OfferedToMe))
	}
}

func TestBuildCareAreasSplitNightsAndSkipSleep(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	a, b := uuid.New(), uuid.New()
	e := func(kind string, h, daysAgo int, who uuid.UUID) store.CareLogEntry {
		return store.CareLogEntry{Kind: kind, AuthorMemberID: who, StartedAt: now.AddDate(0, 0, -daysAgo).Truncate(24 * time.Hour).Add(time.Duration(h) * time.Hour)}
	}
	got := Build(Input{Now: now, Actor: a, Care: []store.CareLogEntry{
		e("feed", 9, 1, a), e("feed", 2, 1, b), e("feed", 23, 2, b), e("diaper", 10, 9, a), e("sleep", 10, 1, a), e("feed", 14, 20, a),
	}, Shifts: []store.Shift{{MemberID: b, Status: "active", Days: []string{"mon", "tue"}, StartTime: "22:00", EndTime: "06:00"}}})
	byKey := map[string]Area{}
	for _, x := range got {
		byKey[x.Key] = x
	}
	if n := byKey[Nights]; n.Owned[0].MemberID != b || n.Owned[0].Count != 2 || *n.Owned[0].RecentCount != 2 || n.Started != nil {
		t.Errorf("nights = %+v", n)
	}
	if f := byKey[Feeding]; f.Owned[0].Count != 1 {
		t.Errorf("feeding = %+v", f)
	}
	if d := byKey[Diapers]; *d.Owned[0].RecentCount != 0 || d.Owned[0].Count != 1 {
		t.Errorf("diapers 9 days ago are in the window but not recent: %+v", d)
	}
	if s := byKey[CareShifts]; s.Owned[0].MemberID != b || s.Owned[0].Count != 16 {
		t.Errorf("shifts = %+v", s)
	}
	if len(got) != 4 {
		t.Errorf("sleep and entries older than 14 days add no area: %d areas", len(got))
	}
}
