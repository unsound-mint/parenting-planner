package httpapi

import (
	"context"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Manual completions are not sensitive (no health data, only "finished the
// swaddle manual"), so the handlers read the one table directly instead of
// going through a domain package. Each person sees only their own rows.

func (s *Server) ListManuals(ctx context.Context, req ListManualsRequestObject) (ListManualsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListManuals401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListManuals404JSONResponse(errNoMember), nil
	}
	rows, err := s.q.ListManualCompletions(ctx, store.ListManualCompletionsParams{FamilyID: familyID, MemberID: req.MemberId})
	if err != nil {
		return nil, err
	}
	done := make(map[string]time.Time, len(rows))
	for _, r := range rows {
		done[r.ManualID] = r.CompletedAt
	}
	out := ManualList{Items: make([]Manual, 0, len(content.Manuals()))}
	for _, m := range content.Manuals() {
		item := manualOut(m)
		if at, ok := done[m.ID]; ok {
			at = at.UTC()
			item.CompletedAt = &at
		}
		out.Items = append(out.Items, item)
	}
	return ListManuals200JSONResponse(out), nil
}

func (s *Server) CompleteManual(ctx context.Context, req CompleteManualRequestObject) (CompleteManualResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CompleteManual401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CompleteManual404JSONResponse(errNoMember), nil
	}
	m, ok := content.ManualByID(req.ManualId)
	if !ok {
		return CompleteManual404JSONResponse(errNotFoundManual), nil
	}
	row, err := s.q.CompleteManual(ctx, store.CompleteManualParams{FamilyID: familyID, MemberID: req.MemberId, ManualID: m.ID, CompletedAt: s.now(ctx)})
	if err != nil {
		return nil, err
	}
	item := manualOut(m)
	at := row.CompletedAt.UTC()
	item.CompletedAt = &at
	return CompleteManual200JSONResponse(item), nil
}

func manualOut(m content.Manual) Manual {
	out := Manual{Id: m.ID, Title: m.Title, Summary: m.Summary, Minutes: m.Minutes,
		Steps: make([]ManualStep, 0, len(m.Steps)), Check: make([]ManualCheck, 0, len(m.Check))}
	for _, st := range m.Steps {
		step := ManualStep{Scene: st.Scene, Title: st.Title, Text: st.Text}
		if st.Watch != "" {
			w := st.Watch
			step.Watch = &w
		}
		out.Steps = append(out.Steps, step)
	}
	for _, q := range m.Check {
		c := ManualCheck{Id: q.ID, Prompt: q.Prompt, CorrectChoice: q.Correct, Choices: make([]SimulatorChoice, 0, len(q.Choices))}
		for _, ch := range q.Choices {
			c.Choices = append(c.Choices, SimulatorChoice{Id: ch.ID, Text: ch.Text})
		}
		out.Check = append(out.Check, c)
	}
	return out
}
