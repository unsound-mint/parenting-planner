// Package couplelab is the Parenting Compatibility Lab: scenario cards two
// parents answer on their own. Answers stay hidden from the other parent until
// both answered that card; then the card is revealed as agreement or as a
// conversation prompt. There is no score, percentage or ranking anywhere.
package couplelab

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	ErrUnknownCard   = errors.New("unknown card")
	ErrUnknownChoice = errors.New("unknown choice")
	ErrRevealed      = errors.New("both parents already answered this card")
	ErrOtherText     = errors.New("other_text only goes with other")
)

// PromptPrefix marks a lab conversation prompt in the couple talks list.
const PromptPrefix = "lab:"

// Answer is what one parent chose.
type Answer struct {
	ChoiceID  string
	OtherText *string
}

// State is one card for the viewing parent.
type State struct {
	Card        Card
	Mine        *Answer
	PartnerDone bool    // the other parent answered (the choice stays hidden until I do)
	Theirs      *Answer // set only when both answered
	Agree       bool    // set only when both answered
}

// Revealed is both answers given: the card shows as agreement or a talk.
func (s State) Revealed() bool { return s.Mine != nil && s.Theirs != nil }

// Agreed reports two answers match. "Something else" never counts as agreeing:
// the texts differ even when the choice id is the same, so they are worth reading together.
func Agreed(a, b Answer) bool { return a.ChoiceID == b.ChoiceID && a.ChoiceID != Other }

// List builds every card's state for the viewer. other is the other parent, or
// uuid.Nil when the family has one parent.
func List(ctx context.Context, pool *pgxpool.Pool, familyID, viewer, other uuid.UUID) ([]State, error) {
	q := store.New(pool)
	rows, err := q.ListLabAnswersRevealedToParent(ctx, store.ListLabAnswersRevealedToParentParams{FamilyID: familyID, ViewerID: viewer})
	if err != nil {
		return nil, err
	}
	answered, err := q.ListLabAnsweredCards(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return build(rows, answered, viewer, other), nil
}

func build(rows []store.LabAnswer, answered []store.ListLabAnsweredCardsRow, viewer, other uuid.UUID) []State {
	mine, theirs := map[string]Answer{}, map[string]Answer{}
	for _, r := range rows {
		a := Answer{ChoiceID: r.ChoiceID, OtherText: r.OtherText}
		if r.MemberID == viewer {
			mine[r.CardID] = a
		} else {
			theirs[r.CardID] = a
		}
	}
	done := map[string]bool{}
	for _, r := range answered {
		if r.MemberID == other && other != uuid.Nil {
			done[r.CardID] = true
		}
	}
	out := make([]State, 0, len(Cards))
	for _, card := range Cards {
		s := State{Card: card, PartnerDone: done[card.ID]}
		if a, ok := mine[card.ID]; ok {
			s.Mine = &a
			if t, ok := theirs[card.ID]; ok {
				s.Theirs, s.Agree = &t, Agreed(a, t)
			}
		}
		out = append(out, s)
	}
	return out
}

// Answer saves the viewer's answer to a card. It can be changed until the
// other parent has answered too; after that the reveal has happened.
func Save(ctx context.Context, pool *pgxpool.Pool, familyID, actor, other uuid.UUID, cardID, choiceID string, otherText *string, now time.Time) (State, error) {
	card, ok := ByID(cardID)
	if !ok {
		return State{}, ErrUnknownCard
	}
	if !ValidChoice(card, choiceID) {
		return State{}, ErrUnknownChoice
	}
	var text *string
	if otherText != nil {
		if t := strings.TrimSpace(*otherText); t != "" {
			text = &t
		}
	}
	if choiceID != Other {
		text = nil
	}
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		cards, err := q.ListLabAnsweredCards(ctx, familyID)
		if err != nil {
			return err
		}
		var mine, theirs bool
		for _, r := range cards {
			if r.CardID != cardID {
				continue
			}
			mine = mine || r.MemberID == actor
			theirs = theirs || (r.MemberID == other && other != uuid.Nil)
		}
		if mine && theirs {
			return ErrRevealed
		}
		_, err = q.UpsertLabAnswer(ctx, store.UpsertLabAnswerParams{
			FamilyID: familyID, MemberID: actor, CardID: cardID, ChoiceID: choiceID, OtherText: text, AnsweredAt: now,
		})
		return err
	})
	if err != nil {
		return State{}, err
	}
	states, err := List(ctx, pool, familyID, actor, other)
	if err != nil {
		return State{}, err
	}
	for _, s := range states {
		if s.Card.ID == cardID {
			return s, nil
		}
	}
	return State{}, ErrUnknownCard
}

// TalkPrompts are the conversation prompts of the cards that were revealed and
// differ, in card order. They join the couple talks list (internal/together).
func TalkPrompts(states []State) []Card {
	var out []Card
	for _, s := range states {
		if s.Revealed() && !s.Agree {
			out = append(out, s.Card)
		}
	}
	return out
}
