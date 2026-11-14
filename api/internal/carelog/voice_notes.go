package carelog

import (
	"context"
	"mime"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const entityVoiceNote = "voice_note"

// MaxVoiceNoteBytes is about a minute of speech from MediaRecorder.
const MaxVoiceNoteBytes = 1 << 20

// UnattachedTTL is how long a note may wait for a handoff before it is deleted.
const UnattachedTTL = 24 * time.Hour

// voiceNoteTypes are what browsers' MediaRecorder produces: webm (Chrome,
// Firefox), mp4 (Safari) and ogg (older Firefox).
var voiceNoteTypes = map[string]bool{"audio/webm": true, "audio/mp4": true, "audio/ogg": true}

// VoiceNoteType checks an upload's Content-Type and returns it in a clean
// form (lowercase, parameters such as codecs kept) for storing and serving.
func VoiceNoteType(contentType string) (string, bool) {
	mt, params, err := mime.ParseMediaType(contentType)
	if err != nil || !voiceNoteTypes[mt] {
		return "", false
	}
	return mime.FormatMediaType(mt, params), true
}

type NewVoiceNote struct {
	ContentType     string // already checked by VoiceNoteType
	Audio           []byte // 1 to MaxVoiceNoteBytes bytes
	DurationSeconds *int
	CreatedAt       time.Time
}

// CreateVoiceNote stores an unattached note. It first deletes the family's
// notes that waited longer than UnattachedTTL for a handoff, so there is no
// scheduler.
func CreateVoiceNote(ctx context.Context, pool *pgxpool.Pool, familyID, actor uuid.UUID, in NewVoiceNote) (store.CreateVoiceNoteRow, error) {
	var out store.CreateVoiceNoteRow
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		if _, err := q.DeleteStaleVoiceNotes(ctx, store.DeleteStaleVoiceNotesParams{
			FamilyID: familyID, Before: in.CreatedAt.Add(-UnattachedTTL),
		}); err != nil {
			return err
		}
		var dur pgtype.Int4
		if in.DurationSeconds != nil {
			dur = pgtype.Int4{Int32: int32(*in.DurationSeconds), Valid: true}
		}
		n, err := q.CreateVoiceNote(ctx, store.CreateVoiceNoteParams{
			FamilyID: familyID, UploaderMemberID: actor, ContentType: in.ContentType,
			SizeBytes: int32(len(in.Audio)), DurationSeconds: dur, Audio: in.Audio, CreatedAt: in.CreatedAt,
		})
		if err != nil {
			return err
		}
		out = n
		return access.Audit(ctx, q, familyID, actor, access.ActionCreate, entityVoiceNote, n.ID.String())
	})
	return out, err
}

// GetVoiceNote returns a note the viewer may play, or pgx.ErrNoRows: the
// uploader, or whoever may see the handoff the note is attached to. A caregiver
// without care_log may play nothing.
func GetVoiceNote(ctx context.Context, pool *pgxpool.Pool, familyID uuid.UUID, viewer Person, id uuid.UUID) (store.VoiceNote, error) {
	if !viewer.CanUse() {
		return store.VoiceNote{}, pgx.ErrNoRows
	}
	var out store.VoiceNote
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.GetVoiceNoteVisibleToMember(ctx, store.GetVoiceNoteVisibleToMemberParams{
			ID: id, FamilyID: familyID, ViewerID: viewer.ID, SeesAllHandoffs: viewer.isParent(),
		})
		if err != nil {
			return err
		}
		out = n
		return access.Audit(ctx, q, familyID, viewer.ID, access.ActionRead, entityVoiceNote, n.ID.String())
	})
	return out, err
}
