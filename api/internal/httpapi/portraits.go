package httpapi

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/unsound-mint/parenting-planner/api/internal/portraits"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// The monthly portrait flipbook. Parents upload and delete; caregivers may
// look with baby_passport (children) or pregnancy_updates (the bump).

var (
	errNoPortrait          = Error{Code: "not_found", Message: "no such portrait"}
	errPortraitSlot        = Error{Code: "invalid_request", Message: "send childId with month for a child, or week alone for the bump"}
	errPortraitType        = Error{Code: "invalid_request", Message: "send a JPEG or PNG photo"}
	errPortraitUnreadable  = Error{Code: "invalid_request", Message: "this photo could not be read"}
	errPortraitDimensions  = Error{Code: "invalid_request", Message: "a photo can be at most 4096 pixels on a side"}
	errPortraitEmpty       = Error{Code: "invalid_request", Message: "the photo is empty"}
	errPortraitTooLarge    = Error{Code: "too_large", Message: "a photo can be at most 1.5 MB"}
	errPortraitsNotAllowed = Error{Code: "forbidden", Message: "this person may not see the family's portraits"}
)

func portraitPerson(m store.Member) portraits.Person {
	return portraits.Person{ID: m.ID, Role: m.Role, Permissions: m.Permissions}
}

func portraitJSON(p portraits.Portrait) Portrait {
	return Portrait{
		Id: p.ID, ChildId: p.ChildID, Month: p.Month, Week: p.Week, Kind: PortraitKind(p.Kind),
		UploadedBy: p.UploadedBy, Width: p.Width, Height: p.Height, CreatedAt: p.CreatedAt.UTC(),
	}
}

func (s *Server) ListPortraits(ctx context.Context, req ListPortraitsRequestObject) (ListPortraitsResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListPortraits401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListPortraits404JSONResponse(errNoMember), nil
	}
	viewer := portraitPerson(m)
	if !viewer.CanSeeAny() {
		return ListPortraits403JSONResponse(errPortraitsNotAllowed), nil
	}
	ps, err := portraits.List(ctx, s.pool, familyID, viewer)
	if err != nil {
		return nil, err
	}
	out := PortraitList{Items: make([]Portrait, 0, len(ps))}
	for _, p := range ps {
		out.Items = append(out.Items, portraitJSON(p))
	}
	return ListPortraits200JSONResponse(out), nil
}

func (s *Server) CreatePortrait(ctx context.Context, req CreatePortraitRequestObject) (CreatePortraitResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreatePortrait401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreatePortrait404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return CreatePortrait403JSONResponse(errForbidden), nil
	}
	slot := portraits.Slot{ChildID: req.Params.ChildId, Month: req.Params.Month, Week: req.Params.Week}
	if !slot.Valid() {
		return CreatePortrait400JSONResponse(errPortraitSlot), nil
	}
	// Read one byte past the limit to tell "exactly the limit" from "more".
	raw, err := io.ReadAll(io.LimitReader(req.Body, portraits.MaxBytes+1))
	if err != nil {
		return nil, err
	}
	switch {
	case len(raw) > portraits.MaxBytes:
		return CreatePortrait413JSONResponse(errPortraitTooLarge), nil
	case len(raw) == 0:
		return CreatePortrait400JSONResponse(errPortraitEmpty), nil
	}
	// The format is read from the bytes; the Content-Type header is not trusted.
	photo, err := portraits.Sanitize(raw)
	switch {
	case errors.Is(err, portraits.ErrType):
		return CreatePortrait400JSONResponse(errPortraitType), nil
	case errors.Is(err, portraits.ErrUnreadable):
		return CreatePortrait400JSONResponse(errPortraitUnreadable), nil
	case errors.Is(err, portraits.ErrDimensions):
		return CreatePortrait400JSONResponse(errPortraitDimensions), nil
	case err != nil:
		return nil, err
	}
	p, err := portraits.Create(ctx, s.pool, familyID, m.ID, slot, photo, s.now(ctx))
	if errors.Is(err, portraits.ErrNoChild) {
		return CreatePortrait404JSONResponse(errNoChild), nil
	}
	if err != nil {
		return nil, err
	}
	return CreatePortrait201JSONResponse(portraitJSON(p)), nil
}

func (s *Server) DeletePortrait(ctx context.Context, req DeletePortraitRequestObject) (DeletePortraitResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeletePortrait401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeletePortrait404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return DeletePortrait403JSONResponse(errForbidden), nil
	}
	found, err := portraits.Delete(ctx, s.pool, familyID, m.ID, req.PortraitId)
	if err != nil {
		return nil, err
	}
	if !found {
		return DeletePortrait404JSONResponse(errNoPortrait), nil
	}
	return DeletePortrait204Response{}, nil
}

func (s *Server) GetPortraitImage(ctx context.Context, req GetPortraitImageRequestObject) (GetPortraitImageResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetPortraitImage401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetPortraitImage404JSONResponse(errNoMember), nil
	}
	img, err := portraits.Image(ctx, s.pool, familyID, portraitPerson(m), req.PortraitId)
	if errors.Is(err, pgx.ErrNoRows) {
		return GetPortraitImage404JSONResponse(errNoPortrait), nil
	}
	if err != nil {
		return nil, err
	}
	return portraitImage(img), nil
}

// portraitImage is getPortraitImage's 200. A portrait id never changes its
// bytes (a new upload is a new id), so the browser may keep it privately.
type portraitImage []byte

func (r portraitImage) VisitGetPortraitImageResponse(w http.ResponseWriter) error {
	h := w.Header()
	h.Set("Content-Type", "image/jpeg")
	h.Set("Content-Length", strconv.Itoa(len(r)))
	h.Set("Cache-Control", "private, max-age=3600")
	h.Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, err := w.Write(r)
	return err
}

// capPortraitBody is capVoiceNoteBody for portrait uploads: 413 at once for a
// declared size over the limit, otherwise the body is read at most one byte
// past it before validation buffers it.
func capPortraitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/portraits") {
			if r.ContentLength > portraits.MaxBytes {
				writeError(w, http.StatusRequestEntityTooLarge, errPortraitTooLarge.Code, errPortraitTooLarge.Message)
				return
			}
			r.Body = struct {
				io.Reader
				io.Closer
			}{io.LimitReader(r.Body, portraits.MaxBytes+1), r.Body}
		}
		next.ServeHTTP(w, r)
	})
}
