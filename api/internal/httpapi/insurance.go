package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/insurance"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func insuranceCallOut(c store.InsuranceCall) InsuranceCall {
	out := InsuranceCall{
		Id: c.ID, AuthorId: c.OwnerMemberID, CalledAt: c.CalledAt, Insurer: c.Insurer, Representative: c.Representative,
		ReferenceNumber: c.ReferenceNumber, Topic: InsuranceCallTopic(c.Topic), Summary: c.Summary,
		Visibility: Visibility(c.Visibility), CreatedAt: c.CreatedAt,
	}
	if c.FollowUpOn != nil {
		out.FollowUpOn = &openapi_types.Date{Time: *c.FollowUpOn}
	}
	return out
}

func (s *Server) CreateInsuranceCall(ctx context.Context, req CreateInsuranceCallRequestObject) (CreateInsuranceCallResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateInsuranceCall401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateInsuranceCall404JSONResponse(errNoMember), nil
	}
	b := req.Body
	in := insurance.NewCall{
		CalledAt: b.CalledAt, Insurer: b.Insurer, Representative: b.Representative, ReferenceNumber: b.ReferenceNumber,
		Topic: string(b.Topic), Summary: b.Summary, Visibility: access.Visibility(b.Visibility),
	}
	if b.FollowUpOn != nil {
		in.FollowUpOn = &b.FollowUpOn.Time
	}
	c, err := insurance.Create(ctx, s.pool, familyID, req.MemberId, in)
	if err != nil {
		return nil, err
	}
	return CreateInsuranceCall201JSONResponse(insuranceCallOut(c)), nil
}

func (s *Server) ListInsuranceCalls(ctx context.Context, req ListInsuranceCallsRequestObject) (ListInsuranceCallsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListInsuranceCalls401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListInsuranceCalls404JSONResponse(errNoMember), nil
	}
	rows, err := insurance.List(ctx, s.pool, familyID, req.MemberId, s.now(ctx))
	if err != nil {
		return nil, err
	}
	out := InsuranceCallList{Items: make([]InsuranceCall, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, insuranceCallOut(r))
	}
	return ListInsuranceCalls200JSONResponse(out), nil
}
