package httpapi_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func diaryPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/diary-entries" }

func entry(body, vis string) map[string]any { return map[string]any{"body": body, "visibility": vis} }

func diaryBodies(c *testutil.Client, m httpapi.Parent) map[string]httpapi.DiaryEntry {
	var l httpapi.DiaryEntryList
	c.Get(diaryPath(m), http.StatusOK, &l)
	out := map[string]httpapi.DiaryEntry{}
	for _, e := range l.Items {
		out[e.Body] = e
	}
	return out
}

func TestDiaryValidation(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	c.Post(diaryPath(mom), map[string]any{"body": "x"}, http.StatusBadRequest, nil) // visibility is required
	c.Post(diaryPath(mom), entry("x", "everyone"), http.StatusBadRequest, nil)
	c.Post(diaryPath(mom), entry("", "private"), http.StatusBadRequest, nil)
	c.Post(diaryPath(mom), entry(strings.Repeat("a", 5001), "private"), http.StatusBadRequest, nil)
	long := entry("x", "private")
	long["agendaTopic"] = strings.Repeat("t", 121)
	c.Post(diaryPath(mom), long, http.StatusBadRequest, nil)
	testutil.New(t).Post(diaryPath(mom), entry("x", "private"), http.StatusUnauthorized, nil)
}

func TestDiaryEntriesFollowTheSharingRulesAndAreEncrypted(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	clearDiary(c, t, fam)
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var made httpapi.DiaryEntry
	c.Post(diaryPath(mom), entry("I cried in the car today.", "private"), http.StatusCreated, &made)
	c.Post(diaryPath(mom), entry("Feeling hopeful about the scan.", "partner"), http.StatusCreated, nil)
	c.Post(diaryPath(mom), entry("The family dinner went well.", "family"), http.StatusCreated, nil)
	c.Post(diaryPath(mom), entry("Seen by the care team only.", "care_team"), http.StatusCreated, nil)
	c.Post(diaryPath(jake), entry("Jake's own private thought.", "private"), http.StatusCreated, nil)
	if made.AuthorId != mom.Id || made.Visibility != httpapi.VisibilityPrivate || made.Body != "I cried in the car today." {
		t.Errorf("created = %+v", made)
	}

	moms, jakes := diaryBodies(c, mom), diaryBodies(c, jake)
	if len(moms) != 4 || moms["Jake's own private thought."].Id != uuid.Nil {
		t.Errorf("Mom sees her four and none of Jake's private: %v", keys(moms))
	}
	if len(jakes) != 3 || jakes["I cried in the car today."].Id != uuid.Nil || jakes["Seen by the care team only."].Id != uuid.Nil || jakes["Feeling hopeful about the scan."].Id == uuid.Nil || jakes["The family dinner went well."].Id == uuid.Nil {
		t.Errorf("Jake sees his own plus what Mom shared with the partner or the family: %v", keys(jakes))
	}
	// Newest first.
	var l httpapi.DiaryEntryList
	c.Get(diaryPath(mom), http.StatusOK, &l)
	for i := 1; i < len(l.Items); i++ {
		if l.Items[i].WrittenAt.After(l.Items[i-1].WrittenAt) {
			t.Errorf("not newest first at %d", i)
		}
	}
	// Encrypted at rest: the text is not in the database.
	var plain int
	if err := c.Pool.QueryRow(context.Background(), `SELECT count(*) FROM diary_entries WHERE family_id = $1 AND position(convert_to('cried', 'UTF8') in body_sealed) > 0`, fam.Id).Scan(&plain); err != nil || plain != 0 {
		t.Errorf("the entry text must not be stored in the clear: %d %v", plain, err)
	}
	// Only the last 30 days.
	if _, err := c.Pool.Exec(context.Background(), `UPDATE diary_entries SET written_at = $2 WHERE id = $1`, made.Id, testutil.Now.AddDate(0, 0, -31)); err != nil {
		t.Fatal(err)
	}
	if _, ok := diaryBodies(c, mom)["I cried in the car today."]; ok {
		t.Error("entries older than 30 days must not be listed")
	}
}

func keys(m map[string]httpapi.DiaryEntry) []string {
	out := []string{}
	for k := range m {
		out = append(out, k)
	}
	return out
}

func TestOnlyTheAuthorChangesWhoReadsAnEntry(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var e httpapi.DiaryEntry
	c.Post(diaryPath(mom), entry("A thought to share later.", "private"), http.StatusCreated, &e)
	path := diaryPath(mom) + "/" + e.Id.String()

	if _, seen := diaryBodies(c, jake)["A thought to share later."]; seen {
		t.Fatal("private to begin with")
	}
	var shared httpapi.DiaryEntry
	c.Patch(path, map[string]any{"visibility": "partner"}, http.StatusOK, &shared)
	if shared.Visibility != httpapi.VisibilityPartner || shared.Body != "A thought to share later." {
		t.Errorf("shared = %+v", shared)
	}
	if _, seen := diaryBodies(c, jake)["A thought to share later."]; !seen {
		t.Error("Jake sees it once shared")
	}
	// Jake can read it but it is not his to change; 404 does not reveal that it exists.
	c.Patch(diaryPath(jake)+"/"+e.Id.String(), map[string]any{"visibility": "family"}, http.StatusNotFound, nil)
	c.Patch(path, map[string]any{"visibility": "private"}, http.StatusOK, nil) // unshare
	if _, seen := diaryBodies(c, jake)["A thought to share later."]; seen {
		t.Error("unsharing hides it again")
	}
	c.Patch(path, map[string]any{}, http.StatusBadRequest, nil) // visibility is always sent
	c.Patch(diaryPath(mom)+"/"+uuid.NewString(), map[string]any{"visibility": "private"}, http.StatusNotFound, nil)
	if n := c.AuditCount(fam.Id, "update", "diary_entry"); n != 2 {
		t.Errorf("update audit rows = %d, want 2", n)
	}
}

func TestAgendaTopicsComeFromDiaryEntriesAndStayWithTheirAuthor(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	topicTexts := func(m httpapi.Parent) []string {
		var a httpapi.PsychologistAgenda
		c.Get(agendaPath(m), http.StatusOK, &a)
		out := []string{}
		for _, tp := range a.Topics {
			out = append(out, tp.Text)
		}
		return out
	}
	has := func(list []string, s string) bool {
		for _, x := range list {
			if x == s {
				return true
			}
		}
		return false
	}
	body := entry("Long private text that must never reach the agenda.", "private")
	body["agendaTopic"] = "  Worries about going back to work  "
	var e httpapi.DiaryEntry
	c.Post(diaryPath(mom), body, http.StatusCreated, &e)
	if e.AgendaTopic == nil || *e.AgendaTopic != "Worries about going back to work" {
		t.Errorf("the topic is trimmed and returned to its author: %+v", e.AgendaTopic)
	}
	// The topic goes to the author's agenda even though the entry stays private; never the text.
	mt := topicTexts(mom)
	if !has(mt, "Worries about going back to work") {
		t.Errorf("Mom's agenda = %v", mt)
	}
	for _, x := range mt {
		if strings.Contains(x, "Long private text") {
			t.Error("the entry text must never become a topic")
		}
	}
	if has(topicTexts(jake), "Worries about going back to work") {
		t.Error("the agenda belongs to its author")
	}
	// Shared with the partner, the entry is readable, but the topic is not returned to Jake.
	c.Patch(diaryPath(mom)+"/"+e.Id.String(), map[string]any{"visibility": "family"}, http.StatusOK, nil) // keeps the topic
	if got := diaryBodies(c, jake)["Long private text that must never reach the agenda."]; got.Id == uuid.Nil || got.AgendaTopic != nil {
		t.Errorf("Jake reads the entry without its agenda topic: %+v", got)
	}
	if !has(topicTexts(mom), "Worries about going back to work") {
		t.Error("an update that does not send agendaTopic keeps it")
	}
	// Change it, then remove it with an empty string.
	var upd httpapi.DiaryEntry
	c.Patch(diaryPath(mom)+"/"+e.Id.String(), map[string]any{"visibility": "private", "agendaTopic": "Sleep and the baby"}, http.StatusOK, &upd)
	if mt := topicTexts(mom); !has(mt, "Sleep and the baby") || has(mt, "Worries about going back to work") {
		t.Errorf("topic changed: %v", mt)
	}
	var cleared httpapi.DiaryEntry
	c.Patch(diaryPath(mom)+"/"+e.Id.String(), map[string]any{"visibility": "private", "agendaTopic": ""}, http.StatusOK, &cleared)
	if cleared.AgendaTopic != nil || has(topicTexts(mom), "Sleep and the baby") {
		t.Errorf("an empty string removes the topic: %+v", cleared)
	}
}

func TestDiaryIsAuditedAndScoped(t *testing.T) {
	c := testutil.New(t)
	first := c.StartDemo("pregnancy")
	momA := testutil.Parent(t, first, httpapi.ParentRoleMother)
	c.Post(diaryPath(momA), entry("Audited", "private"), http.StatusCreated, nil)
	diaryBodies(c, momA)
	if c.AuditCount(first.Id, "create", "diary_entry") != 1 || c.AuditCount(first.Id, "read", "diary_entry") != 1 {
		t.Error("create and read must each be audited once")
	}
	for _, cg := range first.Caregivers { // a caregiver never sees any entry
		c.Get("/api/members/"+cg.Id.String()+"/diary-entries", http.StatusNotFound, nil)
		c.Post("/api/members/"+cg.Id.String()+"/diary-entries", entry("x", "family"), http.StatusNotFound, nil)
	}
	second := c.StartDemo("pregnancy") // the client now holds another family's session
	c.Get(diaryPath(momA), http.StatusNotFound, nil)
	if _, leaked := diaryBodies(c, testutil.Parent(t, second, httpapi.ParentRoleMother))["Audited"]; leaked {
		t.Error("another family's entry leaked")
	}
	_ = time.Now
}

// Without DIARY_ENCRYPTION_KEY every restart makes a new key, so entries written before it
// cannot be opened. They are left out; the rest of the diary still loads.
func TestDiaryLeavesOutEntriesSealedWithAnotherKey(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	clearDiary(c, t, fam)
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var old httpapi.DiaryEntry
	c.Post(diaryPath(mom), entry("Written before the restart.", "private"), http.StatusCreated, &old)
	c.Post(diaryPath(mom), entry("Written after the restart.", "private"), http.StatusCreated, nil)
	other, err := crypt.NewKey([]byte(strings.Repeat("k", 32)))
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := other.Seal("Written before the restart.")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Pool.Exec(context.Background(), "UPDATE diary_entries SET body_sealed = $1 WHERE id = $2", sealed, old.Id); err != nil {
		t.Fatal(err)
	}
	got := diaryBodies(c, mom)
	if len(got) != 1 || got["Written after the restart."].Id == uuid.Nil {
		t.Errorf("Mom's diary after a key change: %v", keys(got))
	}
}

func TestDiaryMoodTravelsWithTheEntry(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	for _, m := range []int{0, 6} {
		bad := entry("x", "private")
		bad["mood"] = m
		c.Post(diaryPath(mom), bad, http.StatusBadRequest, nil)
	}
	shared := entry("Jake talked to the bump.", "partner")
	shared["mood"] = 4
	private := entry("Heavy day, kept it to myself.", "private")
	private["mood"] = 1
	var made httpapi.DiaryEntry
	c.Post(diaryPath(mom), shared, http.StatusCreated, &made)
	c.Post(diaryPath(mom), private, http.StatusCreated, nil)
	c.Post(diaryPath(mom), entry("No face today.", "private"), http.StatusCreated, nil)
	if made.Mood == nil || *made.Mood != 4 {
		t.Errorf("created mood = %v", made.Mood)
	}
	moms := diaryBodies(c, mom)
	if m := moms["Heavy day, kept it to myself."].Mood; m == nil || *m != 1 {
		t.Errorf("Mom reads her own mood: %v", m)
	}
	if m := moms["No face today."].Mood; m != nil {
		t.Errorf("no mood stays absent: %v", *m)
	}
	jakes := diaryBodies(c, jake)
	if m := jakes["Jake talked to the bump."].Mood; m == nil || *m != 4 {
		t.Errorf("Jake reads the mood of the entry shared with him: %v", m)
	}
	if _, ok := jakes["Heavy day, kept it to myself."]; ok {
		t.Error("a private entry and its mood never reach the partner")
	}
	// A diary mood is not a check-in: it adds no low-days topic.
	var a httpapi.PsychologistAgenda
	c.Get(agendaPath(mom), http.StatusOK, &a)
	before := len(a.Topics)
	for range 3 {
		low := entry("Low.", "private")
		low["mood"] = 1
		c.Post(diaryPath(mom), low, http.StatusCreated, nil)
	}
	c.Get(agendaPath(mom), http.StatusOK, &a)
	if len(a.Topics) != before {
		t.Errorf("diary moods must not change the agenda: %d -> %d", before, len(a.Topics))
	}
}

func TestAgendaLinksTopicsToTheirEntryAndSuggestsFromOwnEntriesOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	agenda := func(m httpapi.Parent) httpapi.PsychologistAgenda {
		var a httpapi.PsychologistAgenda
		c.Get(agendaPath(m), http.StatusOK, &a)
		return a
	}
	withTopic := entry("Nervous about not knowing when it starts.", "private")
	withTopic["agendaTopic"] = "Not knowing when labour will start"
	var e httpapi.DiaryEntry
	c.Post(diaryPath(mom), withTopic, http.StatusCreated, &e)
	found := false
	for _, tp := range agenda(mom).Topics {
		if tp.Text == "Not knowing when labour will start" {
			found = tp.DiaryEntryId != nil && *tp.DiaryEntryId == e.Id
		} else if tp.DiaryEntryId != nil {
			t.Errorf("a check-in topic has no entry: %+v", tp)
		}
	}
	if !found {
		t.Error("a topic from the journal links back to its entry")
	}

	// Two entries about sleep, both shared with Jake: a suggestion for Mom only.
	var older, newer httpapi.DiaryEntry
	c.Post(diaryPath(mom), entry("Could not get back to sleep after the kicks.", "partner"), http.StatusCreated, &older)
	c.Post(diaryPath(mom), entry("Woke at 3 again and ran through the drive in my head.", "family"), http.StatusCreated, &newer)
	a := agenda(mom)
	if a.Suggestions == nil || len(*a.Suggestions) != 1 {
		t.Fatalf("Mom gets one suggestion: %+v", a.Suggestions)
	}
	s := (*a.Suggestions)[0]
	if s.Text != "Sleep lately" || s.DiaryEntryId != newer.Id || strings.Contains(s.Reason, "Woke") || strings.Contains(s.Text, "Woke") {
		t.Errorf("suggestion = %+v", s)
	}
	if ja := agenda(jake); ja.Suggestions != nil && len(*ja.Suggestions) > 0 {
		t.Errorf("entries Mom shared with Jake never suggest topics to him: %+v", *ja.Suggestions)
	}
	// Taking it is a diary update; then it is a topic and no longer suggested.
	c.Patch(diaryPath(mom)+"/"+s.DiaryEntryId.String(), map[string]any{"visibility": "family", "agendaTopic": s.Text}, http.StatusOK, nil)
	a = agenda(mom)
	if a.Suggestions != nil && len(*a.Suggestions) > 0 {
		t.Errorf("a taken suggestion is gone: %+v", *a.Suggestions)
	}
	// The agenda reads the diary, so the read is audited.
	if c.AuditCount(fam.Id, "read", "diary_entry") == 0 {
		t.Error("agenda reads of the diary are audited")
	}
}

func TestDiaryFirstsAreMarkedByTheAuthorAndFollowTheEntry(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	kick := entry("First kick Jake could feel.", "partner")
	kick["first"] = true
	var e httpapi.DiaryEntry
	c.Post(diaryPath(mom), kick, http.StatusCreated, &e)
	if !e.First {
		t.Error("created as a first")
	}
	var plain httpapi.DiaryEntry
	c.Post(diaryPath(mom), entry("Ordinary day.", "private"), http.StatusCreated, &plain)
	if plain.First {
		t.Error("not a first unless marked")
	}
	if !diaryBodies(c, jake)["First kick Jake could feel."].First {
		t.Error("the partner sees the mark on a shared entry")
	}
	// A visibility change keeps the mark; sending first changes it; only the author can.
	c.Patch(diaryPath(mom)+"/"+e.Id.String(), map[string]any{"visibility": "private"}, http.StatusOK, &e)
	if !e.First {
		t.Error("leaving first out keeps it")
	}
	c.Patch(diaryPath(mom)+"/"+e.Id.String(), map[string]any{"visibility": "private", "first": false}, http.StatusOK, &e)
	if e.First {
		t.Error("first: false unmarks it")
	}
	c.Patch(diaryPath(jake)+"/"+e.Id.String(), map[string]any{"visibility": "partner", "first": true}, http.StatusNotFound, nil)
}

// clearDiary removes the seeded entries, for tests that count what a family's diary holds.
func clearDiary(c *testutil.Client, t *testing.T, fam httpapi.Family) {
	t.Helper()
	if _, err := c.Pool.Exec(t.Context(), "DELETE FROM diary_entries WHERE family_id = $1", fam.Id); err != nil {
		t.Fatal(err)
	}
}
