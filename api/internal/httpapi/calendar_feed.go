package httpapi

import "context"

// STUB for #261: the contract is in openapi.yaml, the implementation is
// not written yet. Replace each stub with a real handler (copy wellbeing.go),
// remove its 501 from openapi.yaml and replace its test. The web hides the
// feature on 501.

func (s *Server) GetCalendarFeed(_ context.Context, _ GetCalendarFeedRequestObject) (GetCalendarFeedResponseObject, error) {
	return GetCalendarFeed501JSONResponse(Error{Code: "not_implemented", Message: "calendar subscriptions are not available yet"}), nil
}

func (s *Server) CreateCalendarFeed(_ context.Context, _ CreateCalendarFeedRequestObject) (CreateCalendarFeedResponseObject, error) {
	return CreateCalendarFeed501JSONResponse(Error{Code: "not_implemented", Message: "calendar subscriptions are not available yet"}), nil
}

func (s *Server) DeleteCalendarFeed(_ context.Context, _ DeleteCalendarFeedRequestObject) (DeleteCalendarFeedResponseObject, error) {
	return DeleteCalendarFeed501JSONResponse(Error{Code: "not_implemented", Message: "calendar subscriptions are not available yet"}), nil
}

func (s *Server) GetCalendarFeedFile(_ context.Context, _ GetCalendarFeedFileRequestObject) (GetCalendarFeedFileResponseObject, error) {
	return GetCalendarFeedFile501JSONResponse(Error{Code: "not_implemented", Message: "calendar subscriptions are not available yet"}), nil
}
