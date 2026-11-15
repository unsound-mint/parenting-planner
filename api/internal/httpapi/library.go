package httpapi

import (
	"context"

	"github.com/unsound-mint/parenting-planner/api/internal/content"
)

var errNoLibraryTopic = Error{Code: "not_found", Message: "no such topic in the library"}

// ListLibraryTopics is the Questions library placed against the family's now.
// The list carries no body text, so the page stays small; the body comes from
// GetLibraryTopic when a parent opens a topic.
func (s *Server) ListLibraryTopics(ctx context.Context, req ListLibraryTopicsRequestObject) (ListLibraryTopicsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListLibraryTopics401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListLibraryTopics404JSONResponse(errNoMember), nil
	}
	state, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	entries, position := content.Library(state)
	soon := content.Upcoming()
	out := LibraryTopicList{Position: position, Items: make([]LibraryTopicSummary, 0, len(entries)), Upcoming: make([]LibraryUpcoming, 0, len(soon))}
	for _, e := range entries {
		out.Items = append(out.Items, librarySummaryOut(e))
	}
	for _, u := range soon {
		out.Upcoming = append(out.Upcoming, LibraryUpcoming{
			Id: u.ID, Title: u.Title, Summary: u.Summary, Category: u.Category,
			Stages: stagesOut(u.Stages), Minutes: u.Minutes, Format: u.Format,
		})
	}
	return ListLibraryTopics200JSONResponse(out), nil
}

func (s *Server) GetLibraryTopic(ctx context.Context, req GetLibraryTopicRequestObject) (GetLibraryTopicResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetLibraryTopic401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetLibraryTopic404JSONResponse(errNoMember), nil
	}
	if _, ok := content.LibraryTopicByID(req.TopicId); !ok {
		return GetLibraryTopic404JSONResponse(errNoLibraryTopic), nil
	}
	state, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	entries, _ := content.Library(state)
	byID := make(map[string]content.LibraryEntry, len(entries))
	for _, e := range entries {
		byID[e.ID] = e
	}
	e := byID[req.TopicId]
	sum := librarySummaryOut(e)
	out := LibraryTopic{
		Id: sum.Id, Title: sum.Title, Questions: sum.Questions, Category: sum.Category, Evidence: sum.Evidence,
		Ages: sum.Ages, Now: sum.Now, Soon: sum.Soon, Urgent: sum.Urgent, Stages: sum.Stages, Minutes: sum.Minutes,
		WhatToKnow: e.WhatToKnow, EvidenceNote: e.EvidenceNote,
		WhatToDo: make([]LibraryStep, 0, len(e.WhatToDo)), Sources: make([]Source, 0, len(e.Sources)),
		Related: make([]LibraryTopicSummary, 0, len(e.Related)),
	}
	if e.AskClinicianIf != "" {
		out.AskClinicianIf = &e.AskClinicianIf
	}
	for _, st := range e.WhatToDo {
		out.WhatToDo = append(out.WhatToDo, LibraryStep{When: st.When, Action: st.Action})
	}
	for _, src := range e.Sources {
		out.Sources = append(out.Sources, sourceOut(src))
	}
	for _, id := range e.Related {
		if r, ok := byID[id]; ok {
			out.Related = append(out.Related, librarySummaryOut(r))
		}
	}
	return GetLibraryTopic200JSONResponse(out), nil
}

func librarySummaryOut(e content.LibraryEntry) LibraryTopicSummary {
	return LibraryTopicSummary{
		Id: e.ID, Title: e.Title, Questions: e.Questions, Category: e.Category,
		Evidence: LibraryEvidence(e.Evidence), Ages: e.Ages, Now: e.Now, Soon: e.Soon, Urgent: e.Urgent,
		Stages: stagesOut(content.TopicStages(e.LibraryTopic)), Minutes: content.TopicMinutes(e.LibraryTopic),
	}
}

func stagesOut(in []string) []LibraryStage {
	out := make([]LibraryStage, len(in))
	for i, s := range in {
		out[i] = LibraryStage(s)
	}
	return out
}
