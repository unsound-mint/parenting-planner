package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/couplelab"
	"github.com/unsound-mint/parenting-planner/api/internal/together"
)

// The lab is parents only: actingMember answers 404 for a caregiver. The other
// parent's choice leaves the server only inside a reveal, which couplelab builds
// from answers the viewer is allowed to see (ListLabAnswersRevealedToParent).

var (
	errUnknownCard = Error{Code: "unknown_card", Message: "no such scenario card"}
	errBadChoice   = Error{Code: "invalid_request", Message: "that answer is not on the card"}
	errLabRevealed = Error{Code: "revealed", Message: "both parents already answered this card"}
)

func labAnswerOut(a couplelab.Answer) LabAnswer {
	return LabAnswer{ChoiceId: LabAnswerChoiceId(a.ChoiceID), OtherText: a.OtherText}
}

// talkedAt looks the lab prompt up in the couple talks, so the card shows "talked about".
func labCardOut(s couplelab.State, talks map[string]together.Prompt) LabCard {
	out := LabCard{Id: s.Card.ID, Topic: s.Card.Topic, Situation: s.Card.Situation, PartnerAnswered: s.PartnerDone, Choices: make([]LabChoice, 0, len(s.Card.Choices))}
	for _, c := range s.Card.Choices {
		out.Choices = append(out.Choices, LabChoice{Id: LabChoiceId(c.ID), Label: c.Label})
	}
	if s.Mine != nil {
		a := labAnswerOut(*s.Mine)
		out.Mine = &a
	}
	if s.Revealed() {
		tp := TalkPrompt{Id: couplelab.PromptPrefix + s.Card.ID, Text: s.Card.Prompt}
		if p, ok := talks[tp.Id]; ok && p.TalkedAt != nil {
			at, by := p.TalkedAt.UTC(), p.TalkedBy
			tp.TalkedAt, tp.TalkedBy = &at, &by
		}
		out.Reveal = &LabReveal{Theirs: labAnswerOut(*s.Theirs), Agree: s.Agree, TalkPrompt: tp}
	}
	return out
}

func (s *Server) talkedLabPrompts(ctx context.Context, familyID, me uuid.UUID) (map[string]together.Prompt, error) {
	talks, err := s.q.ListCoupleTalks(ctx, familyID)
	if err != nil {
		return nil, err
	}
	out := map[string]together.Prompt{}
	for _, t := range talks {
		at := t.TalkedAt
		out[t.PromptID] = together.Prompt{ID: t.PromptID, TalkedAt: &at, TalkedBy: t.TalkedBy}
	}
	return out, nil
}

func (s *Server) GetCoupleLab(ctx context.Context, req GetCoupleLabRequestObject) (GetCoupleLabResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetCoupleLab401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetCoupleLab404JSONResponse(errNoMember), nil
	}
	_, _, other, _, err := s.learnCouple(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	states, err := couplelab.List(ctx, s.pool, familyID, req.MemberId, other.ID)
	if err != nil {
		return nil, err
	}
	talks, err := s.talkedLabPrompts(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	out := CoupleLab{Cards: make([]LabCard, 0, len(states))}
	for _, st := range states {
		out.Cards = append(out.Cards, labCardOut(st, talks))
	}
	return GetCoupleLab200JSONResponse(out), nil
}

func (s *Server) CreateLabAnswer(ctx context.Context, req CreateLabAnswerRequestObject) (CreateLabAnswerResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateLabAnswer401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateLabAnswer404JSONResponse(errNoMember), nil
	}
	_, _, other, _, err := s.learnCouple(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	b := req.Body
	st, err := couplelab.Save(ctx, s.pool, familyID, req.MemberId, other.ID, b.CardId, string(b.ChoiceId), b.OtherText, s.now(ctx))
	switch {
	case errors.Is(err, couplelab.ErrUnknownCard):
		return CreateLabAnswer404JSONResponse(errUnknownCard), nil
	case errors.Is(err, couplelab.ErrUnknownChoice):
		return CreateLabAnswer400JSONResponse(errBadChoice), nil
	case errors.Is(err, couplelab.ErrRevealed):
		return CreateLabAnswer409JSONResponse(errLabRevealed), nil
	case err != nil:
		return nil, err
	}
	talks, err := s.talkedLabPrompts(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	return CreateLabAnswer201JSONResponse(labCardOut(st, talks)), nil
}
