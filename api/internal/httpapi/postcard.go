package httpapi

import (
	"context"
	"slices"
	"strconv"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/admin"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/postcard"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var errPostcardUnavailable = Error{Code: "not_available", Message: "there is no postcard yet: pregnancy and baby stages only"}

// postcardProblem says why no postcard can be built for the acting person.
type postcardProblem int

const (
	postcardOK postcardProblem = iota
	postcardForbidden
	postcardUnavailable
)

// postcardBase is the content of this week's card and its period key, the same
// for everyone who may open it. The access rule: parents always; a grandparent
// needs pregnancy_updates in pregnancy and baby_passport after birth; a nanny
// never. A planning family, or a baby stage with no child, has no card.
func (s *Server) postcardBase(ctx context.Context, familyID uuid.UUID, m store.Member) (pc Postcard, key string, problem postcardProblem, err error) {
	if m.Role == "nanny" {
		return pc, "", postcardForbidden, nil
	}
	state, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return pc, "", postcardOK, err
	}
	grandparent := m.Role == "grandparent"
	if state.Stage == "pregnancy" {
		if !state.HasWeek {
			return pc, "", postcardUnavailable, nil
		}
		if grandparent && !slices.Contains(m.Permissions, "pregnancy_updates") {
			return pc, "", postcardForbidden, nil
		}
		card, _ := content.WeekCard(state.Week, content.Viewer{Role: "mother"}, state.Week)
		edits, err := admin.Edits(ctx, s.q, familyID)
		if err != nil {
			return pc, "", postcardOK, err
		}
		card = edits.Card(card)
		src := card.Source
		if len(card.Size.Sources) > 0 {
			src = card.Size.Sources[0]
		}
		comparison := card.Size.Comparison
		pc = Postcard{
			Kind: PostcardKindPregnancy, Stage: Stage(state.Stage), Period: weekWord(state.Week),
			Headline: "About the size of " + comparison, Comparison: &comparison, Source: sourceOut(src),
		}
		if card.Development != "" {
			d := card.Development
			pc.Detail = &d
		}
		return pc, postcard.PregnancyKey(state.Week), postcardOK, nil
	}
	if state.Stage == "planning" || state.Stage == "trying" {
		return pc, "", postcardUnavailable, nil
	}
	kids, err := s.q.ListChildren(ctx, familyID)
	if err != nil {
		return pc, "", postcardOK, err
	}
	if len(kids) == 0 {
		return pc, "", postcardUnavailable, nil
	}
	if grandparent && !slices.Contains(m.Permissions, "baby_passport") {
		return pc, "", postcardForbidden, nil
	}
	// ListChildren is oldest first; the youngest decides the content.
	birth := kids[len(kids)-1].BirthDate
	line := content.NowForChild(birth, s.today(ctx))
	pc = Postcard{Kind: PostcardKindBaby, Stage: Stage(state.Stage), Period: line.Period, Headline: line.Headline}
	if line.Detail != "" {
		d := line.Detail
		pc.Detail = &d
	}
	if len(line.Sources) > 0 {
		pc.Source = sourceOut(line.Sources[0])
	}
	return pc, postcard.ChildKey(birth, s.today(ctx)), postcardOK, nil
}

func weekWord(week int) string { return "Week " + strconv.Itoa(week) }

// withPostcardExtras adds the parents' line and the loves the acting person may see.
func (s *Server) withPostcardExtras(ctx context.Context, familyID uuid.UUID, m store.Member, key string, pc Postcard) (Postcard, error) {
	line, err := postcard.GetLine(ctx, s.q, familyID, key)
	if err != nil {
		return pc, err
	}
	if line != nil {
		pc.Line = &PostcardLine{Text: line.Text, AuthorName: line.AuthorName, UpdatedAt: line.UpdatedAt}
	}
	var from *uuid.UUID
	if !isParentRole(m.Role) {
		from = &m.ID
	}
	now := s.now(ctx)
	loves, err := postcard.Loves(ctx, s.q, familyID, from, now)
	if err != nil {
		return pc, err
	}
	pc.Loves = make([]PostcardLove, 0, len(loves))
	for _, l := range loves {
		out := PostcardLove{Id: l.ID, FromName: l.FromName, SentAt: l.SentAt}
		if l.Message != "" {
			msg := l.Message
			out.Message = &msg
		}
		pc.Loves = append(pc.Loves, out)
		if from != nil && dateOf(l.SentAt).Equal(dateOf(now)) {
			pc.LoveSentToday = true
		}
	}
	return pc, nil
}

func (s *Server) GetPostcard(ctx context.Context, req GetPostcardRequestObject) (GetPostcardResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetPostcard401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetPostcard404JSONResponse(errNoMember), nil
	}
	pc, key, problem, err := s.postcardBase(ctx, familyID, m)
	switch {
	case err != nil:
		return nil, err
	case problem == postcardForbidden:
		return GetPostcard403JSONResponse(errForbidden), nil
	case problem == postcardUnavailable:
		return GetPostcard409JSONResponse(errPostcardUnavailable), nil
	}
	pc, err = s.withPostcardExtras(ctx, familyID, m, key, pc)
	if err != nil {
		return nil, err
	}
	return GetPostcard200JSONResponse(pc), nil
}

func (s *Server) SetPostcardLine(ctx context.Context, req SetPostcardLineRequestObject) (SetPostcardLineResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SetPostcardLine401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return SetPostcardLine404JSONResponse(errNoMember), nil
	case !isParentRole(m.Role):
		return SetPostcardLine403JSONResponse(errForbidden), nil
	}
	pc, key, problem, err := s.postcardBase(ctx, familyID, m)
	switch {
	case err != nil:
		return nil, err
	case problem != postcardOK:
		return SetPostcardLine409JSONResponse(errPostcardUnavailable), nil
	}
	if err := postcard.SetLine(ctx, s.q, familyID, key, m, req.Body.Text, s.now(ctx)); err != nil {
		return nil, err
	}
	pc, err = s.withPostcardExtras(ctx, familyID, m, key, pc)
	if err != nil {
		return nil, err
	}
	return SetPostcardLine200JSONResponse(pc), nil
}

func (s *Server) SendPostcardLove(ctx context.Context, req SendPostcardLoveRequestObject) (SendPostcardLoveResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SendPostcardLove401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return SendPostcardLove404JSONResponse(errNoMember), nil
	case m.Role != "grandparent":
		return SendPostcardLove403JSONResponse(errForbidden), nil
	}
	pc, key, problem, err := s.postcardBase(ctx, familyID, m)
	switch {
	case err != nil:
		return nil, err
	case problem == postcardForbidden:
		return SendPostcardLove403JSONResponse(errForbidden), nil
	case problem == postcardUnavailable:
		return SendPostcardLove409JSONResponse(errPostcardUnavailable), nil
	}
	msg := ""
	if req.Body.Message != nil {
		msg = *req.Body.Message
	}
	if err := postcard.SendLove(ctx, s.pool, familyID, m, msg, s.today(ctx), s.now(ctx)); err != nil {
		return nil, err
	}
	pc, err = s.withPostcardExtras(ctx, familyID, m, key, pc)
	if err != nil {
		return nil, err
	}
	return SendPostcardLove200JSONResponse(pc), nil
}
