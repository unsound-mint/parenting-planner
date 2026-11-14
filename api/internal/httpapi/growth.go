package httpapi

import (
	"context"
	"errors"
	"math"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/health"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var errNoMeasurement = Error{Code: "not_found", Message: "no such growth measurement"}

func growthIn(b GrowthMeasurementInput) health.Growth {
	g := health.Growth{MeasuredOn: b.MeasuredOn.Time, WeightKg: float64(b.WeightKg), HeightCm: float64(b.HeightCm)}
	if b.HeadCm != nil {
		v := float64(*b.HeadCm)
		g.HeadCm = &v
	}
	return g
}

func growthOut(g store.GrowthMeasurement, born store.Child) GrowthPoint {
	out := GrowthPoint{
		Id: g.ID, MeasuredOn: openapi_types.Date{Time: g.MeasuredOn}, AgeMonths: monthsBetween(born.BirthDate, g.MeasuredOn),
		AgeDays:  int(math.Round(g.MeasuredOn.Sub(born.BirthDate).Hours() / 24)),
		WeightKg: float32(g.WeightKg), HeightCm: float32(g.HeightCm),
	}
	if g.HeadCm != nil {
		v := float32(*g.HeadCm)
		out.HeadCm = &v
	}
	return out
}

// growthChild is the child the measurement is about, for its age at the visit.
func (s *Server) growthChild(ctx context.Context, g store.GrowthMeasurement) (store.Child, error) {
	kids, err := s.q.ListChildren(ctx, g.FamilyID)
	if err != nil {
		return store.Child{}, err
	}
	for _, c := range kids {
		if c.ID == g.ChildID {
			return c, nil
		}
	}
	return store.Child{}, errors.New("growth measurement without its child")
}

func (s *Server) CreateGrowthMeasurement(ctx context.Context, req CreateGrowthMeasurementRequestObject) (CreateGrowthMeasurementResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateGrowthMeasurement401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateGrowthMeasurement404JSONResponse(errNoMember), nil
	}
	g, err := health.LogGrowth(ctx, s.pool, familyID, req.MemberId, req.Body.ChildId, s.today(ctx), growthIn(*req.Body))
	switch {
	case errors.Is(err, health.ErrNoChild):
		return CreateGrowthMeasurement404JSONResponse(errNoChild), nil
	case errors.Is(err, health.ErrFutureDate):
		return CreateGrowthMeasurement400JSONResponse(errFutureDate), nil
	case err != nil:
		return nil, err
	}
	child, err := s.growthChild(ctx, g)
	if err != nil {
		return nil, err
	}
	return CreateGrowthMeasurement201JSONResponse(growthOut(g, child)), nil
}

func (s *Server) UpdateGrowthMeasurement(ctx context.Context, req UpdateGrowthMeasurementRequestObject) (UpdateGrowthMeasurementResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateGrowthMeasurement401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateGrowthMeasurement404JSONResponse(errNoMember), nil
	}
	g, err := health.UpdateGrowth(ctx, s.pool, familyID, req.MemberId, req.MeasurementId, s.today(ctx), growthIn(*req.Body))
	switch {
	case errors.Is(err, health.ErrNoMeasurement):
		return UpdateGrowthMeasurement404JSONResponse(errNoMeasurement), nil
	case errors.Is(err, health.ErrFutureDate):
		return UpdateGrowthMeasurement400JSONResponse(errFutureDate), nil
	case err != nil:
		return nil, err
	}
	child, err := s.growthChild(ctx, g)
	if err != nil {
		return nil, err
	}
	return UpdateGrowthMeasurement200JSONResponse(growthOut(g, child)), nil
}

func (s *Server) DeleteGrowthMeasurement(ctx context.Context, req DeleteGrowthMeasurementRequestObject) (DeleteGrowthMeasurementResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteGrowthMeasurement401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteGrowthMeasurement404JSONResponse(errNoMember), nil
	}
	switch err := health.DeleteGrowth(ctx, s.pool, familyID, req.MemberId, req.MeasurementId); {
	case errors.Is(err, health.ErrNoMeasurement):
		return DeleteGrowthMeasurement404JSONResponse(errNoMeasurement), nil
	case err != nil:
		return nil, err
	}
	return DeleteGrowthMeasurement204Response{}, nil
}
