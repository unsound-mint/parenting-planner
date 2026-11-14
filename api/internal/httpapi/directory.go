package httpapi

// STUBS: the directory contract landed before its implementation (#175).
// Replace each method with a real handler (see wellbeing.go) and delete
// notImplemented once none of them uses it.

import (
	"context"
	"net/http"
)

// notImplemented answers 501 with the shared Error body. The generated
// response interfaces only need a Visit method, so it can stand in for all of them.
type notImplemented struct{}

func (notImplemented) write(w http.ResponseWriter) error {
	writeError(w, http.StatusNotImplemented, "not_implemented", "the provider directory is not available yet")
	return nil
}

type listProvidersNotImplemented struct{ notImplemented }

func (r listProvidersNotImplemented) VisitListProvidersResponse(w http.ResponseWriter) error {
	return r.write(w)
}

type createBookingRequestNotImplemented struct{ notImplemented }

func (r createBookingRequestNotImplemented) VisitCreateBookingRequestResponse(w http.ResponseWriter) error {
	return r.write(w)
}

type listBookingRequestsNotImplemented struct{ notImplemented }

func (r listBookingRequestsNotImplemented) VisitListBookingRequestsResponse(w http.ResponseWriter) error {
	return r.write(w)
}

func (s *Server) ListProviders(context.Context, ListProvidersRequestObject) (ListProvidersResponseObject, error) {
	return listProvidersNotImplemented{}, nil
}

func (s *Server) CreateBookingRequest(context.Context, CreateBookingRequestRequestObject) (CreateBookingRequestResponseObject, error) {
	return createBookingRequestNotImplemented{}, nil
}

func (s *Server) ListBookingRequests(context.Context, ListBookingRequestsRequestObject) (ListBookingRequestsResponseObject, error) {
	return listBookingRequestsNotImplemented{}, nil
}
