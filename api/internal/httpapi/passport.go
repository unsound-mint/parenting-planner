package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
)

// STUB for #172: the contract is in openapi.yaml, the implementation is not
// written yet. Replace this file with real handlers (copy wellbeing.go) and
// delete passportNotImplemented. The web screen shows an empty state on 501.

type passportNotImplemented struct{}

func (passportNotImplemented) VisitGetPassportResponse(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	return json.NewEncoder(w).Encode(Error{Code: "not_implemented", Message: "the health passport is not available yet"})
}

func (s *Server) GetPassport(ctx context.Context, req GetPassportRequestObject) (GetPassportResponseObject, error) {
	return passportNotImplemented{}, nil
}
