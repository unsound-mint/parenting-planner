package httpapi

import "context"

// STUB: the contract for the childcare tracker is in openapi.yaml, the
// implementation is not written yet. The web shows preview mocks on 501.
// The parents-only check is real already, so caregivers get 403.

var errChildcareNotImplemented = Error{Code: "not_implemented", Message: "the childcare tracker is not available yet"}

func (s *Server) ListChildcareOptions(ctx context.Context, _ ListChildcareOptionsRequestObject) (ListChildcareOptionsResponseObject, error) {
	switch _, kind := managingFamily(ctx); kind {
	case errUnauthorized:
		return ListChildcareOptions401JSONResponse(errNoSession), nil
	case errNotParent:
		return ListChildcareOptions403JSONResponse(errForbidden), nil
	}
	return ListChildcareOptions501JSONResponse(errChildcareNotImplemented), nil
}

func (s *Server) CreateChildcareOption(ctx context.Context, _ CreateChildcareOptionRequestObject) (CreateChildcareOptionResponseObject, error) {
	switch _, kind := managingFamily(ctx); kind {
	case errUnauthorized:
		return CreateChildcareOption401JSONResponse(errNoSession), nil
	case errNotParent:
		return CreateChildcareOption403JSONResponse(errForbidden), nil
	}
	return CreateChildcareOption501JSONResponse(errChildcareNotImplemented), nil
}

func (s *Server) GetChildcareOption(ctx context.Context, _ GetChildcareOptionRequestObject) (GetChildcareOptionResponseObject, error) {
	switch _, kind := managingFamily(ctx); kind {
	case errUnauthorized:
		return GetChildcareOption401JSONResponse(errNoSession), nil
	case errNotParent:
		return GetChildcareOption403JSONResponse(errForbidden), nil
	}
	return GetChildcareOption501JSONResponse(errChildcareNotImplemented), nil
}

func (s *Server) UpdateChildcareOption(ctx context.Context, _ UpdateChildcareOptionRequestObject) (UpdateChildcareOptionResponseObject, error) {
	switch _, kind := managingFamily(ctx); kind {
	case errUnauthorized:
		return UpdateChildcareOption401JSONResponse(errNoSession), nil
	case errNotParent:
		return UpdateChildcareOption403JSONResponse(errForbidden), nil
	}
	return UpdateChildcareOption501JSONResponse(errChildcareNotImplemented), nil
}

func (s *Server) DeleteChildcareOption(ctx context.Context, _ DeleteChildcareOptionRequestObject) (DeleteChildcareOptionResponseObject, error) {
	switch _, kind := managingFamily(ctx); kind {
	case errUnauthorized:
		return DeleteChildcareOption401JSONResponse(errNoSession), nil
	case errNotParent:
		return DeleteChildcareOption403JSONResponse(errForbidden), nil
	}
	return DeleteChildcareOption501JSONResponse(errChildcareNotImplemented), nil
}
