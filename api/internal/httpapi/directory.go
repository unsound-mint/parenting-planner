package httpapi

// STUBS: the directory contract landed before its implementation (#175).
// Replace each method with a real handler (see wellbeing.go) and remove the
// 501 responses from openapi.yaml.

import "context"

var errDirectoryNotBuilt = Error{Code: "not_implemented", Message: "the provider directory is not available yet"}

func (s *Server) ListProviders(context.Context, ListProvidersRequestObject) (ListProvidersResponseObject, error) {
	return ListProviders501JSONResponse(errDirectoryNotBuilt), nil
}

func (s *Server) CreateBookingRequest(context.Context, CreateBookingRequestRequestObject) (CreateBookingRequestResponseObject, error) {
	return CreateBookingRequest501JSONResponse(errDirectoryNotBuilt), nil
}

func (s *Server) ListBookingRequests(context.Context, ListBookingRequestsRequestObject) (ListBookingRequestsResponseObject, error) {
	return ListBookingRequests501JSONResponse(errDirectoryNotBuilt), nil
}
