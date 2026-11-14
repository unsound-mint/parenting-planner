package httpapi

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/unsound-mint/parenting-planner/api/internal/carelog"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Voice notes for handoffs (#291). A note is attached by createHandoff; the
// uploader and whoever may see that handoff can play it.

func (s *Server) CreateVoiceNote(ctx context.Context, req CreateVoiceNoteRequestObject) (CreateVoiceNoteResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateVoiceNote401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateVoiceNote404JSONResponse(errNoMember), nil
	}
	contentType, ok := carelog.VoiceNoteType(req.ContentType)
	if !ok {
		return CreateVoiceNote400JSONResponse(errVoiceNoteType), nil
	}
	// Read one byte past the limit to tell "exactly 1 MB" from "more".
	audio, err := io.ReadAll(io.LimitReader(req.Body, carelog.MaxVoiceNoteBytes+1))
	if err != nil {
		return nil, err
	}
	switch {
	case len(audio) > carelog.MaxVoiceNoteBytes:
		return CreateVoiceNote413JSONResponse(errVoiceNoteTooLarge), nil
	case len(audio) == 0:
		return CreateVoiceNote400JSONResponse(errVoiceNoteEmpty), nil
	}
	n, err := carelog.CreateVoiceNote(ctx, s.pool, familyID, m.ID, carelog.NewVoiceNote{
		ContentType: contentType, Audio: audio, DurationSeconds: req.Params.DurationSeconds,
		// Real time, not the demo clock: the 24-hour cleanup must not delete a
		// note recorded a minute ago because the family skipped ahead a week.
		CreatedAt: s.cfg.Now(),
	})
	if err != nil {
		return nil, err
	}
	return CreateVoiceNote201JSONResponse(voiceNoteJSON(n)), nil
}

func (s *Server) GetVoiceNote(ctx context.Context, req GetVoiceNoteRequestObject) (GetVoiceNoteResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetVoiceNote401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetVoiceNote404JSONResponse(errNoMember), nil
	}
	n, err := carelog.GetVoiceNote(ctx, s.pool, familyID, carePerson(m), req.VoiceNoteId)
	if errors.Is(err, pgx.ErrNoRows) {
		return GetVoiceNote404JSONResponse(errNoVoiceNote), nil
	}
	if err != nil {
		return nil, err
	}
	return voiceNoteAudio{contentType: n.ContentType, audio: n.Audio}, nil
}

func voiceNoteJSON(n store.CreateVoiceNoteRow) VoiceNote {
	out := VoiceNote{Id: n.ID, ContentType: n.ContentType, SizeBytes: int(n.SizeBytes), CreatedAt: n.CreatedAt.UTC()}
	if n.DurationSeconds.Valid {
		d := int(n.DurationSeconds.Int32)
		out.DurationSeconds = &d
	}
	return out
}

// voiceNoteAudio is getVoiceNote's 200. The generated audio response cannot
// set Cache-Control; a note never changes, so the browser may keep it.
type voiceNoteAudio struct {
	contentType string
	audio       []byte
}

func (r voiceNoteAudio) VisitGetVoiceNoteResponse(w http.ResponseWriter) error {
	h := w.Header()
	h.Set("Content-Type", r.contentType)
	h.Set("Content-Length", strconv.Itoa(len(r.audio)))
	h.Set("Cache-Control", "private, max-age=3600")
	h.Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, err := w.Write(r.audio)
	return err
}

// capVoiceNoteBody runs before request validation, which reads the whole body
// into memory. An upload that declares more than the limit gets 413 at once;
// any other is read at most one byte past the limit, so CreateVoiceNote can
// still tell that it was too big.
func capVoiceNoteBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/voice-notes") {
			if r.ContentLength > carelog.MaxVoiceNoteBytes {
				writeError(w, http.StatusRequestEntityTooLarge, errVoiceNoteTooLarge.Code, errVoiceNoteTooLarge.Message)
				return
			}
			r.Body = struct {
				io.Reader
				io.Closer
			}{io.LimitReader(r.Body, carelog.MaxVoiceNoteBytes+1), r.Body}
		}
		next.ServeHTTP(w, r)
	})
}
