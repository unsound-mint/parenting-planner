package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func voiceNotesPath(p httpapi.Parent) string {
	return "/api/members/" + p.Id.String() + "/voice-notes"
}

// uploadVoiceNote posts raw audio and returns the status and, on 201, the note.
func uploadVoiceNote(t *testing.T, c *testutil.Client, path, contentType string, audio []byte) (int, httpapi.VoiceNote) {
	t.Helper()
	code, raw := c.Raw(http.MethodPost, path, contentType, bytes.NewReader(audio))
	var n httpapi.VoiceNote
	if code == http.StatusCreated {
		if err := json.Unmarshal(raw, &n); err != nil {
			t.Fatal(err)
		}
	}
	return code, n
}

func TestVoiceNoteUploadAndPlayBack(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("newborn"), httpapi.ParentRoleMother)
	audio := []byte("synthetic opus frames, not a real voice")

	code, n := uploadVoiceNote(t, c, voiceNotesPath(mom)+"?durationSeconds=12", "audio/webm;codecs=opus", audio)
	if code != http.StatusCreated {
		t.Fatalf("upload: status %d, want 201", code)
	}
	if n.ContentType != "audio/webm; codecs=opus" || n.SizeBytes != len(audio) || n.DurationSeconds == nil || *n.DurationSeconds != 12 {
		t.Errorf("note = %+v", n)
	}
	if !n.CreatedAt.Equal(testutil.Now) {
		t.Errorf("createdAt = %v, want %v", n.CreatedAt, testutil.Now)
	}

	code, got := c.Raw(http.MethodGet, voiceNotesPath(mom)+"/"+n.Id.String(), "", nil)
	if code != http.StatusOK || !bytes.Equal(got, audio) {
		t.Fatalf("play: status %d, body %q", code, got)
	}
	if ct := c.LastHeader.Get("Content-Type"); ct != "audio/webm; codecs=opus" {
		t.Errorf("Content-Type = %q", ct)
	}
	if cc := c.LastHeader.Get("Cache-Control"); cc != "private, max-age=3600" {
		t.Errorf("Cache-Control = %q", cc)
	}

	// Safari records mp4; no duration is fine.
	if code, n := uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/mp4", audio); code != http.StatusCreated || n.DurationSeconds != nil {
		t.Errorf("mp4 upload: status %d, note %+v", code, n)
	}
}

func TestVoiceNoteValidation(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := voiceNotesPath(mom)

	for _, ct := range []string{"audio/wav", "audio/mpeg", "video/webm", "text/plain", ""} {
		if code, _ := uploadVoiceNote(t, c, path, ct, []byte("abc")); code != http.StatusBadRequest {
			t.Errorf("type %q: status %d, want 400", ct, code)
		}
	}
	if code, _ := uploadVoiceNote(t, c, path, "audio/webm", nil); code != http.StatusBadRequest {
		t.Errorf("empty body: status %d, want 400", code)
	}
	for _, q := range []string{"?durationSeconds=0", "?durationSeconds=121"} {
		if code, _ := uploadVoiceNote(t, c, path+q, "audio/webm", []byte("abc")); code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", q, code)
		}
	}

	exact := bytes.Repeat([]byte{1}, 1<<20)
	if code, _ := uploadVoiceNote(t, c, path, "audio/ogg", exact); code != http.StatusCreated {
		t.Errorf("exactly 1 MB: status %d, want 201", code)
	}
	code, raw := c.Raw(http.MethodPost, path, "audio/webm", bytes.NewReader(append(exact, 1)))
	if code != http.StatusRequestEntityTooLarge || !strings.Contains(string(raw), "too_large") {
		t.Errorf("1 MB + 1 byte: status %d, body %s", code, raw)
	}
	// Without a Content-Length (chunked), the body is cut off just past 1 MB.
	chunked := io.MultiReader(bytes.NewReader(exact), bytes.NewReader(exact))
	if code, raw := c.Raw(http.MethodPost, path, "audio/webm", chunked); code != http.StatusRequestEntityTooLarge {
		t.Errorf("2 MB chunked: status %d, body %s", code, raw)
	}
	var n int
	if err := c.Pool.QueryRow(context.Background(), `SELECT count(*) FROM voice_notes WHERE family_id = $1`, fam.Id).Scan(&n); err != nil || n != 1 {
		t.Errorf("stored notes = %d (%v), want only the 1 MB one", n, err)
	}
}

func TestVoiceNoteIsPrivateBeforeItIsAttached(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom, partner := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	_, n := uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/webm", []byte("abc"))

	// The other parent cannot play it until it is on a handoff they may see.
	if code, _ := c.Raw(http.MethodGet, voiceNotesPath(partner)+"/"+n.Id.String(), "", nil); code != http.StatusNotFound {
		t.Errorf("partner: status %d, want 404", code)
	}
	if code, _ := c.Raw(http.MethodGet, voiceNotesPath(mom)+"/"+uuid.NewString(), "", nil); code != http.StatusNotFound {
		t.Errorf("unknown note: status %d, want 404", code)
	}

	// Another family, even naming the uploader, gets 404.
	other := testutil.New(t)
	other.StartDemo("newborn")
	if code, _ := other.Raw(http.MethodGet, voiceNotesPath(mom)+"/"+n.Id.String(), "", nil); code != http.StatusNotFound {
		t.Errorf("other family: status %d, want 404", code)
	}
	if code, _ := other.Raw(http.MethodPost, voiceNotesPath(mom), "audio/webm", strings.NewReader("abc")); code != http.StatusNotFound {
		t.Errorf("other family upload: status %d, want 404", code)
	}

	anon := testutil.New(t)
	if code, _ := anon.Raw(http.MethodPost, voiceNotesPath(mom), "audio/webm", strings.NewReader("abc")); code != http.StatusUnauthorized {
		t.Errorf("no session upload: status %d, want 401", code)
	}
	if code, _ := anon.Raw(http.MethodGet, voiceNotesPath(mom)+"/"+n.Id.String(), "", nil); code != http.StatusUnauthorized {
		t.Errorf("no session play: status %d, want 401", code)
	}
}

func TestVoiceNoteIsAudited(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	_, n := uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/webm", []byte("abc"))
	c.Raw(http.MethodGet, voiceNotesPath(mom)+"/"+n.Id.String(), "", nil)

	if got := c.AuditCount(fam.Id, "create", "voice_note"); got != 1 {
		t.Errorf("create audit rows = %d, want 1", got)
	}
	if got := c.AuditCount(fam.Id, "read", "voice_note"); got != 1 {
		t.Errorf("read audit rows = %d, want 1", got)
	}
}

func TestUnattachedVoiceNotesAreDeletedAfterADay(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	ctx := context.Background()

	other := testutil.New(t)
	otherFam := other.StartDemo("newborn")
	otherMom := testutil.Parent(t, otherFam, httpapi.ParentRoleMother)

	_, stale := uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/webm", []byte("stale"))
	_, fresh := uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/webm", []byte("fresh"))
	_, attached := uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/webm", []byte("attached"))
	_, otherStale := uploadVoiceNote(t, other, voiceNotesPath(otherMom), "audio/webm", []byte("other"))

	dayAgo := testutil.Now.Add(-25 * time.Hour)
	for _, id := range []uuid.UUID{stale.Id, attached.Id, otherStale.Id} {
		if _, err := c.Pool.Exec(ctx, `UPDATE voice_notes SET created_at = $1 WHERE id = $2`, dayAgo, id); err != nil {
			t.Fatal(err)
		}
	}
	// Stands in for createHandoff (#370) attaching the note.
	if _, err := c.Pool.Exec(ctx, `UPDATE voice_notes SET handoff_id = gen_random_uuid() WHERE id = $1`, attached.Id); err != nil {
		t.Fatal(err)
	}

	uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/webm", []byte("new"))

	exists := func(id uuid.UUID) bool {
		var n int
		if err := c.Pool.QueryRow(ctx, `SELECT count(*) FROM voice_notes WHERE id = $1`, id).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n == 1
	}
	if exists(stale.Id) {
		t.Error("an unattached note older than a day must be deleted on the next upload")
	}
	if !exists(fresh.Id) || !exists(attached.Id) {
		t.Error("fresh and attached notes must stay")
	}
	if !exists(otherStale.Id) {
		t.Error("an upload must only clean up its own family's notes")
	}
}

func TestSkippingAheadDoesNotExpireAFreshVoiceNote(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	_, first := uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/webm", []byte("first"))

	// "Skip ahead a week" between recording and the next upload.
	if _, err := c.Pool.Exec(context.Background(), `UPDATE families SET demo_offset_days = 7 WHERE id = $1`, fam.Id); err != nil {
		t.Fatal(err)
	}
	uploadVoiceNote(t, c, voiceNotesPath(mom), "audio/webm", []byte("second"))
	if code, _ := c.Raw(http.MethodGet, voiceNotesPath(mom)+"/"+first.Id.String(), "", nil); code != http.StatusOK {
		t.Errorf("a note recorded a minute ago is gone after a demo skip: status %d", code)
	}
}
