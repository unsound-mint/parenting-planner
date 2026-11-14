package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func bell(c *testutil.Client, p httpapi.Parent) httpapi.NotificationList {
	var l httpapi.NotificationList
	c.Get("/api/members/"+p.Id.String()+"/notifications", http.StatusOK, &l)
	return l
}

func ofKind(l httpapi.NotificationList, k httpapi.NotificationKind) []httpapi.Notification {
	var out []httpapi.Notification
	for _, n := range l.Items {
		if n.Kind == k {
			out = append(out, n)
		}
	}
	return out
}

func TestNotificationsValidationAndUnknownMember(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	c.Post("/api/members/"+mom.Id.String()+"/notifications/read", map[string]any{"ids": []string{"not-a-uuid"}}, http.StatusBadRequest, nil)
	c.Get("/api/members/"+uuid.NewString()+"/notifications", http.StatusNotFound, nil)
	c.Post("/api/members/"+uuid.NewString()+"/notifications/read", map[string]any{}, http.StatusNotFound, nil)
}

// The seed flags two of Emily's labs. Only Emily is told, the title carries
// no lab name or value, and the older one is already read.
func TestSeededLabFlagsNotifyTheOwnerOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	own := ofKind(bell(c, mom), httpapi.NotificationKindValueFlagged)
	if len(own) != 2 {
		t.Fatalf("Emily has %d value_flagged, want 2", len(own))
	}
	if own[0].ReadAt != nil || own[1].ReadAt == nil {
		t.Errorf("want the newer flag unread and the older one read, got %+v", own)
	}
	for _, n := range own {
		if strings.Contains(n.Title, "Ferritin") || strings.Contains(n.Title, "Vitamin") || strings.ContainsAny(n.Title, "0123456789") {
			t.Errorf("title leaks the lab: %q", n.Title)
		}
	}
	if got := ofKind(bell(c, dad), httpapi.NotificationKindValueFlagged); len(got) != 0 {
		t.Errorf("Jake sees Emily's lab flags: %+v", got)
	}
}

func TestLoggingLabValuesNotifies(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	m := "/api/members/" + mom.Id.String()
	momBefore, dadBefore := len(ofKind(bell(c, mom), httpapi.NotificationKindValueFlagged)), len(ofKind(bell(c, dad), httpapi.NotificationKindValueFlagged))

	// In range: nothing.
	c.Post(m+"/lab-results", map[string]any{"name": "Hemoglobin", "value": 13, "unit": "g/dL", "refLow": 11, "refHigh": 15, "takenOn": "2026-11-13", "visibility": "family"}, http.StatusCreated, nil)
	// Emily's own value, shared with Jake: still only Emily.
	var own httpapi.LabResult
	c.Post(m+"/lab-results", map[string]any{"name": "Ferritin", "value": 9, "unit": "ng/mL", "refLow": 15, "refHigh": 150, "takenOn": "2026-11-13", "visibility": "family"}, http.StatusCreated, &own)
	// The baby's value: both parents.
	var child httpapi.LabResult
	c.Post(m+"/lab-results", map[string]any{"childId": fam.Children[0].Id, "name": "Bilirubin", "value": 18, "unit": "mg/dL", "refLow": 0, "refHigh": 12, "takenOn": "2026-11-13", "visibility": "family"}, http.StatusCreated, &child)

	momFlags, dadFlags := ofKind(bell(c, mom), httpapi.NotificationKindValueFlagged), ofKind(bell(c, dad), httpapi.NotificationKindValueFlagged)
	if len(momFlags)-momBefore != 2 || len(dadFlags)-dadBefore != 1 {
		t.Fatalf("new flags: Emily %d (want 2), the partner %d (want 1)", len(momFlags)-momBefore, len(dadFlags)-dadBefore)
	}
	if *dadFlags[0].EntityId != child.Id.String() || !strings.Contains(dadFlags[0].Title, fam.Children[0].Name) {
		t.Errorf("partner's flag = %+v, want the child's lab %s", dadFlags[0], child.Id)
	}
	if dadFlags[0].ActorId == nil || *dadFlags[0].ActorId != mom.Id || dadFlags[0].ReadAt != nil {
		t.Errorf("partner's flag actor/read = %+v", dadFlags[0])
	}
	for _, n := range dadFlags {
		if *n.EntityId == own.Id.String() {
			t.Error("the partner was told about Emily's own lab")
		}
	}
}

// plan_item_due is computed on read of the plan or the bell, once per rule and
// day, and only for the reader's own items.
func TestPlanItemsDueAreWrittenOncePerDay(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	var pl httpapi.Plan
	c.Get("/api/members/"+mom.Id.String()+"/plan", http.StatusOK, &pl)
	c.Get("/api/members/"+mom.Id.String()+"/plan", http.StatusOK, nil)
	want := map[string]bool{}
	for _, it := range pl.Items {
		if (it.Status == httpapi.PlanItemStatusDue || it.Status == httpapi.PlanItemStatusOverdue) && it.Progress == nil {
			want[it.RuleId] = true
		}
	}
	if len(want) == 0 {
		t.Fatal("the pregnancy demo should have a due item for Emily")
	}
	got := ofKind(bell(c, mom), httpapi.NotificationKindPlanItemDue)
	seen := map[string]int{}
	for _, n := range got {
		seen[*n.EntityId]++
		if n.ActorId != nil {
			t.Errorf("plan_item_due has an actor: %+v", n)
		}
	}
	for rule := range want {
		if seen[rule] != 1 {
			t.Errorf("rule %s notified %d times, want 1", rule, seen[rule])
		}
	}
	if len(seen) != len(want) {
		t.Errorf("notified rules %v, want %v", seen, want)
	}
	// Jake's bell holds items from his own plan only.
	dadPlan := map[string]bool{}
	for _, id := range planIDs(c, dad) {
		dadPlan[id] = true
	}
	for _, n := range ofKind(bell(c, dad), httpapi.NotificationKindPlanItemDue) {
		if !dadPlan[*n.EntityId] {
			t.Errorf("Jake was told about %s, which is not on his plan", *n.EntityId)
		}
	}
}

func TestMarkNotificationsRead(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, dad := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	read := func(p httpapi.Parent, body any) httpapi.NotificationList {
		var l httpapi.NotificationList
		c.Post("/api/members/"+p.Id.String()+"/notifications/read", body, http.StatusOK, &l)
		return l
	}
	before := bell(c, mom)
	if before.UnreadCount < 2 {
		t.Fatalf("Emily should start with unread notifications, has %d", before.UnreadCount)
	}
	var unread httpapi.Notification
	for _, n := range before.Items {
		if n.ReadAt == nil {
			unread = n
			break
		}
	}

	// Jake marking Emily's notification does nothing and reveals nothing.
	dadBefore := bell(c, dad).UnreadCount
	read(dad, map[string]any{"ids": []string{unread.Id.String()}})
	if got := bell(c, mom).UnreadCount; got != before.UnreadCount {
		t.Errorf("Jake changed Emily's unread count: %d -> %d", before.UnreadCount, got)
	}
	if got := bell(c, dad).UnreadCount; got != dadBefore {
		t.Errorf("Jake's own unread count changed: %d -> %d", dadBefore, got)
	}

	// An empty list marks nothing; one id marks that one.
	if got := read(mom, map[string]any{"ids": []string{}}).UnreadCount; got != before.UnreadCount {
		t.Errorf("empty ids changed the count to %d", got)
	}
	after := read(mom, map[string]any{"ids": []string{unread.Id.String()}})
	if after.UnreadCount != before.UnreadCount-1 {
		t.Errorf("unread %d after marking one, want %d", after.UnreadCount, before.UnreadCount-1)
	}
	for _, n := range after.Items {
		if n.Id == unread.Id && (n.ReadAt == nil || !n.ReadAt.Equal(testutil.Now)) {
			t.Errorf("readAt = %v, want %v", n.ReadAt, testutil.Now)
		}
	}

	// No ids: everything.
	if got := read(mom, map[string]any{}).UnreadCount; got != 0 {
		t.Errorf("unread after mark all = %d", got)
	}
	if got := bell(c, dad).UnreadCount; got != dadBefore {
		t.Errorf("mark all touched Jake's: %d -> %d", dadBefore, got)
	}
}
