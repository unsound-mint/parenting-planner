package httpapi

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var (
	errUnknownDeck       = Error{Code: "not_found", Message: "no such quiz deck for this family"}
	errUnknownDeckAnswer = Error{Code: "unknown_question", Message: "a question is not in this deck, or a choice is not in its question"}
)

// UpdateLibraryRead marks a topic read or saved for the acting parent only.
func (s *Server) UpdateLibraryRead(ctx context.Context, req UpdateLibraryReadRequestObject) (UpdateLibraryReadResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateLibraryRead401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateLibraryRead404JSONResponse(errNoMember), nil
	}
	if _, ok := content.LibraryTopicByID(req.TopicId); !ok {
		return UpdateLibraryRead404JSONResponse(errNoLibraryTopic), nil
	}
	flag := func(b *bool) pgtype.Bool {
		if b == nil {
			return pgtype.Bool{}
		}
		return pgtype.Bool{Bool: *b, Valid: true}
	}
	r, err := s.q.UpsertLibraryRead(ctx, store.UpsertLibraryReadParams{
		FamilyID: familyID, MemberID: req.MemberId, TopicID: req.TopicId,
		Read: flag(req.Body.Read), Saved: flag(req.Body.Saved), At: s.now(ctx),
	})
	if err != nil {
		return nil, err
	}
	return UpdateLibraryRead200JSONResponse(LibraryRead{TopicId: r.TopicID, ReadAt: tsOut(r.ReadAt), SavedAt: tsOut(r.SavedAt)}), nil
}

func tsOut(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time.UTC()
	return &v
}

func (s *Server) ListQuizAttempts(ctx context.Context, req ListQuizAttemptsRequestObject) (ListQuizAttemptsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListQuizAttempts401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListQuizAttempts404JSONResponse(errNoMember), nil
	}
	rows, err := s.q.ListQuizAttempts(ctx, store.ListQuizAttemptsParams{FamilyID: familyID, MemberID: req.MemberId})
	if err != nil {
		return nil, err
	}
	out := QuizAttemptList{Items: make([]QuizAttempt, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, quizAttemptOut(r))
	}
	return ListQuizAttempts200JSONResponse(out), nil
}

// CreateQuizAttempt grades a deck retake against the catalog: the client only
// sends choices, so a score cannot be made up.
func (s *Server) CreateQuizAttempt(ctx context.Context, req CreateQuizAttemptRequestObject) (CreateQuizAttemptResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateQuizAttempt401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateQuizAttempt404JSONResponse(errNoMember), nil
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	questions := map[string]content.Question{}
	found := false
	for _, p := range content.LearnPathsFor(st) {
		if p.ID != req.Body.DeckId {
			continue
		}
		found = true
		for _, l := range p.Lessons {
			for _, q := range l.Quiz {
				questions[q.ID] = q
			}
		}
	}
	if !found {
		return CreateQuizAttempt404JSONResponse(errUnknownDeck), nil
	}
	score, seen, missed := 0, map[string]bool{}, []string{}
	for _, a := range req.Body.Answers {
		q, ok := questions[a.QuestionId]
		if !ok || seen[a.QuestionId] || !hasChoice(q, a.ChoiceId) {
			return CreateQuizAttempt400JSONResponse(errUnknownDeckAnswer), nil
		}
		seen[a.QuestionId] = true
		if a.ChoiceId == q.CorrectChoiceID {
			score++
		} else {
			missed = append(missed, q.ID)
		}
	}
	r, err := s.q.CreateQuizAttempt(ctx, store.CreateQuizAttemptParams{
		FamilyID: familyID, MemberID: req.MemberId, DeckID: req.Body.DeckId,
		Score: int32(score), Total: int32(len(req.Body.Answers)), Missed: missed, TakenAt: s.now(ctx),
	})
	if err != nil {
		return nil, err
	}
	return CreateQuizAttempt201JSONResponse(quizAttemptOut(r)), nil
}

func hasChoice(q content.Question, id string) bool {
	for _, c := range q.Choices {
		if c.ID == id {
			return true
		}
	}
	return false
}

func quizAttemptOut(r store.QuizAttempt) QuizAttempt {
	return QuizAttempt{Id: r.ID, DeckId: r.DeckID, Score: int(r.Score), Total: int(r.Total), Missed: r.Missed, TakenAt: r.TakenAt.UTC()}
}
