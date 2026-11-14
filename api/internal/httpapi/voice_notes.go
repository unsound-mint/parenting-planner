package httpapi

import "context"

// STUB for #291: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) CreateVoiceNote(_ context.Context, _ CreateVoiceNoteRequestObject) (CreateVoiceNoteResponseObject, error) {
	return CreateVoiceNote501JSONResponse(Error{Code: "not_implemented", Message: "voice notes are not available yet"}), nil
}

func (s *Server) GetVoiceNote(_ context.Context, _ GetVoiceNoteRequestObject) (GetVoiceNoteResponseObject, error) {
	return GetVoiceNote501JSONResponse(Error{Code: "not_implemented", Message: "voice notes are not available yet"}), nil
}
