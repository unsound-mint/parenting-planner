package httpapi

import (
	"context"
	"errors"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/demo"
)

// CreateCustomSession starts the visitor on a family built from their own
// details, with the same session cookie as CreateDemoSession.
func (s *Server) CreateCustomSession(ctx context.Context, req CreateCustomSessionRequestObject) (CreateCustomSessionResponseObject, error) {
	b := req.Body
	d := demo.Details{
		Stage: string(b.Stage), MotherName: b.MotherName, PartnerName: b.PartnerName,
		DueDate: dateOrNil(b.DueDate), ChildBirthDate: dateOrNil(b.ChildBirthDate),
	}
	if b.ChildName != nil {
		d.ChildName = *b.ChildName
	}
	familyID, token, err := demo.StartCustom(ctx, s.pool, d, s.today())
	if errors.Is(err, demo.ErrBadDetails) {
		// ErrBadDetails messages are written for the visitor and hold no internals.
		return CreateCustomSession400JSONResponse{Code: "bad_details", Message: err.Error()}, nil
	}
	if err != nil {
		return nil, err
	}
	fam, err := s.loadFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	cookie := s.sessionCookieHeader(token)
	return CreateCustomSession201JSONResponse{Body: fam, Headers: CreateCustomSession201ResponseHeaders{SetCookie: &cookie}}, nil
}

func dateOrNil(d *openapi_types.Date) *time.Time {
	if d == nil {
		return nil
	}
	return &d.Time
}
