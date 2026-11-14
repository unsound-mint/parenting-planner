package httpapi

import "context"

// STUB: the contract for the portrait flipbook is in openapi.yaml, the
// implementation is not written yet. The web shows preview mocks on 501.

var errPortraitsNotImplemented = Error{Code: "not_implemented", Message: "portraits are not available yet"}

func (s *Server) ListPortraits(_ context.Context, _ ListPortraitsRequestObject) (ListPortraitsResponseObject, error) {
	return ListPortraits501JSONResponse(errPortraitsNotImplemented), nil
}

func (s *Server) CreatePortrait(_ context.Context, _ CreatePortraitRequestObject) (CreatePortraitResponseObject, error) {
	return CreatePortrait501JSONResponse(errPortraitsNotImplemented), nil
}

func (s *Server) DeletePortrait(_ context.Context, _ DeletePortraitRequestObject) (DeletePortraitResponseObject, error) {
	return DeletePortrait501JSONResponse(errPortraitsNotImplemented), nil
}

func (s *Server) GetPortraitImage(_ context.Context, _ GetPortraitImageRequestObject) (GetPortraitImageResponseObject, error) {
	return GetPortraitImage501JSONResponse(errPortraitsNotImplemented), nil
}
