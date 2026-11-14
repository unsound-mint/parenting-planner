package httpapi

import "context"

// STUB for #132: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web shows an
// empty state on 501.

func (s *Server) GetMemberExport(_ context.Context, _ GetMemberExportRequestObject) (GetMemberExportResponseObject, error) {
	return GetMemberExport501JSONResponse(Error{Code: "not_implemented", Message: "data export is not available yet"}), nil
}

func (s *Server) DeleteFamily(_ context.Context, _ DeleteFamilyRequestObject) (DeleteFamilyResponseObject, error) {
	return DeleteFamily501JSONResponse(Error{Code: "not_implemented", Message: "deleting the family is not available yet"}), nil
}
