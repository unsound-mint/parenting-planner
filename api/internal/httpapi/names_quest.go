package httpapi

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/together"
)

// The names quest is parents only (actingMember answers 404 for a caregiver)
// and open only before a birth (together.QuestOpen, else 409 quest_closed).

var (
	errQuestClosed  = Error{Code: "quest_closed", Message: "the names quest is for before the birth"}
	errUnknownList  = Error{Code: "unknown_list", Message: "no such name list"}
	errFinalLocked  = Error{Code: "final_locked", Message: "the final round opens at five matches"}
	errNotFinalist  = Error{Code: "not_found", Message: "that name is not in the final round"}
	errSameFinalist = Error{Code: "invalid_request", Message: "pick between two different names"}
)

// questCouple resolves the acting parent's family, the other parent and
// whether the quest is open. kind is errNone, errUnauthorized or errNotFound.
func (s *Server) questCouple(ctx context.Context, memberID uuid.UUID) (familyID, other uuid.UUID, open bool, kind errKind, err error) {
	familyID, _, kind, err = s.actingMember(ctx, memberID)
	if err != nil || kind != errNone {
		return familyID, uuid.Nil, false, kind, err
	}
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return familyID, uuid.Nil, false, errNone, err
	}
	parents, err := s.q.ListMembers(ctx, familyID)
	if err != nil {
		return familyID, uuid.Nil, false, errNone, err
	}
	_, o := together.Couple(parents, memberID)
	return familyID, o.ID, together.QuestOpen(fam), errNone, nil
}

func (s *Server) GetNamesQuest(ctx context.Context, req GetNamesQuestRequestObject) (GetNamesQuestResponseObject, error) {
	familyID, other, open, kind, err := s.questCouple(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetNamesQuest401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetNamesQuest404JSONResponse(errNoMember), nil
	case !open:
		return GetNamesQuest409JSONResponse(errQuestClosed), nil
	}
	q, err := together.GetQuest(ctx, s.pool, familyID, req.MemberId, other)
	if err != nil {
		return nil, err
	}
	return GetNamesQuest200JSONResponse(questOut(q)), nil
}

func (s *Server) SetNameLists(ctx context.Context, req SetNameListsRequestObject) (SetNameListsResponseObject, error) {
	familyID, other, open, kind, err := s.questCouple(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SetNameLists401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return SetNameLists404JSONResponse(errNoMember), nil
	case !open:
		return SetNameLists409JSONResponse(errQuestClosed), nil
	}
	q, err := together.SetLists(ctx, s.pool, familyID, req.MemberId, other, req.Body.Lists, s.now(ctx))
	switch {
	case errors.Is(err, together.ErrUnknownList):
		return SetNameLists400JSONResponse(errUnknownList), nil
	case err != nil:
		return nil, err
	}
	return SetNameLists200JSONResponse(questOut(q)), nil
}

func (s *Server) GetNameDeck(ctx context.Context, req GetNameDeckRequestObject) (GetNameDeckResponseObject, error) {
	familyID, other, open, kind, err := s.questCouple(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetNameDeck401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetNameDeck404JSONResponse(errNoMember), nil
	case !open:
		return GetNameDeck409JSONResponse(errQuestClosed), nil
	}
	f := together.DeckFilter{MinBabies: req.Params.MinBabies, MaxBabies: req.Params.MaxBabies}
	if req.Params.Sex != nil {
		f.Sex = string(*req.Params.Sex)
	}
	cards, remaining, err := together.Deck(ctx, s.pool, familyID, req.MemberId, other, f)
	if err != nil {
		return nil, err
	}
	out := NameDeck{Items: make([]NameCard, 0, len(cards)), Remaining: remaining}
	for _, c := range cards {
		out.Items = append(out.Items, nameCardOut(c))
	}
	return GetNameDeck200JSONResponse(out), nil
}

func (s *Server) SwipeName(ctx context.Context, req SwipeNameRequestObject) (SwipeNameResponseObject, error) {
	familyID, other, open, kind, err := s.questCouple(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SwipeName401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return SwipeName404JSONResponse(errNoMember), nil
	case !open:
		return SwipeName409JSONResponse(errQuestClosed), nil
	}
	r, err := together.Swipe(ctx, s.pool, familyID, req.MemberId, other, req.Body.Name, together.Verdict(req.Body.Verdict), s.now(ctx))
	switch {
	case errors.Is(err, together.ErrUnknownName):
		return SwipeName404JSONResponse(errNoBabyName), nil
	case err != nil:
		return nil, err
	}
	card := nameCardOut(r.Card)
	out := NameSwipeResult{Name: r.Name, Verdict: NameVerdict(r.Verdict), Match: r.Match, Card: &card}
	if r.Theirs != "" {
		v := NameVerdict(r.Theirs)
		out.Theirs = &v
	}
	return SwipeName200JSONResponse(out), nil
}

func (s *Server) UndoNameSwipe(ctx context.Context, req UndoNameSwipeRequestObject) (UndoNameSwipeResponseObject, error) {
	familyID, _, open, kind, err := s.questCouple(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UndoNameSwipe401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UndoNameSwipe404JSONResponse(errNoMember), nil
	case !open:
		return UndoNameSwipe409JSONResponse(errQuestClosed), nil
	}
	if err := together.Undo(ctx, s.pool, familyID, req.MemberId, req.Name); err != nil {
		return nil, err
	}
	return UndoNameSwipe204Response{}, nil
}

func (s *Server) JudgeNameDuel(ctx context.Context, req JudgeNameDuelRequestObject) (JudgeNameDuelResponseObject, error) {
	familyID, other, open, kind, err := s.questCouple(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return JudgeNameDuel401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return JudgeNameDuel404JSONResponse(errNoMember), nil
	case !open:
		return JudgeNameDuel409JSONResponse(errQuestClosed), nil
	}
	q, err := together.Judge(ctx, s.pool, familyID, req.MemberId, other, req.Body.WinnerId, req.Body.LoserId, s.now(ctx))
	switch {
	case errors.Is(err, together.ErrSameFinalist):
		return JudgeNameDuel400JSONResponse(errSameFinalist), nil
	case errors.Is(err, together.ErrNotFinalist):
		return JudgeNameDuel404JSONResponse(errNotFinalist), nil
	case errors.Is(err, together.ErrFinalLocked):
		return JudgeNameDuel409JSONResponse(errFinalLocked), nil
	case err != nil:
		return nil, err
	}
	return JudgeNameDuel200JSONResponse(questOut(q)), nil
}

var nameSex = map[string]NameSex{"F": Girl, "M": Boy, "N": Neutral}

func nameCardOut(c together.NameCard) NameCard {
	out := NameCard{Name: c.Name, Lists: []string{}}
	if c.ID != uuid.Nil {
		id := c.ID
		out.Id = &id
	}
	if c.AddedBy != uuid.Nil {
		by := c.AddedBy
		out.AddedBy = &by
	}
	if n := c.Catalog; n != nil {
		sex := nameSex[n.Sex]
		out.Sex = &sex
		out.Lists = n.Lists
		if n.Meaning != "" {
			origin, meaning, src := n.Origin, n.Meaning, n.Source
			out.Origin, out.Meaning, out.SourceUrl = &origin, &meaning, &src
		}
		pop := NamePopularity{Babies: n.Babies(), Trend: n.Trend}
		if r := n.Rank(); r > 0 {
			pop.Rank = &r
		}
		out.Popularity = &pop
	}
	return out
}

func questOut(q together.Quest) NamesQuest {
	cat := content.Names()
	checked, _ := time.Parse(time.DateOnly, cat.CheckedAt)
	out := NamesQuest{
		Lists:      make([]NameListOption, 0, len(cat.Lists)),
		Chosen:     q.Chosen,
		Year:       cat.Year,
		TrendYears: cat.TrendYears,
		Sources: []Source{
			{Title: "US Social Security Administration, popular baby names", Url: cat.Sources["ssa"], CheckedAt: openapi_types.Date{Time: checked}},
			{Title: "Wiktionary (CC BY-SA), name entries", Url: cat.Sources["meanings"], CheckedAt: openapi_types.Date{Time: checked}},
		},
		SwipeGoal: together.SwipeGoal,
		MatchGoal: together.MatchGoal,
		Progress:  make([]NameQuestProgress, 0, len(q.Progress)),
		Stages:    make([]NameQuestStage, 0, len(q.Stages)),
		Matches:   cards(q.Matches),
		TalkAbout: make([]NameVerdicts, 0, len(q.TalkAbout)),
		PairCount: q.PairCount,
		NextPair:  cards(q.NextPair),
		Top:       cards(q.Top),
	}
	for _, l := range cat.Lists {
		out.Lists = append(out.Lists, NameListOption{Id: l.ID, Title: l.Title, Size: cat.ListSize(l.ID)})
	}
	for _, p := range q.Progress {
		out.Progress = append(out.Progress, NameQuestProgress{MemberId: p.MemberID, Swiped: p.Swiped, Judged: p.Judged})
	}
	for _, st := range q.Stages {
		out.Stages = append(out.Stages, NameQuestStage{Id: NameQuestStageId(st.ID), Done: st.Done})
	}
	for _, t := range q.TalkAbout {
		out.TalkAbout = append(out.TalkAbout, NameVerdicts{Card: nameCardOut(t.Card), Mine: NameVerdict(t.Mine), Theirs: NameVerdict(t.Theirs)})
	}
	if q.FinishedAt != nil {
		at := q.FinishedAt.UTC()
		out.FinishedAt = &at
	}
	return out
}

func cards(cs []together.NameCard) []NameCard {
	out := make([]NameCard, 0, len(cs))
	for _, c := range cs {
		out = append(out, nameCardOut(c))
	}
	return out
}
