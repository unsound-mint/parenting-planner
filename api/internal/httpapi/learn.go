package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/learn"
	"github.com/unsound-mint/parenting-planner/api/internal/together"
)

// Learning paths are parents only: actingMember answers 404 for a caregiver.

var (
	errUnknownLesson   = Error{Code: "unknown_lesson", Message: "no such lesson for this family"}
	errLessonLocked    = Error{Code: "lesson_locked", Message: "this lesson opens later in the pregnancy"}
	errUnknownQuestion = Error{Code: "not_found", Message: "no such quiz question for this family"}
	errUnknownChoice   = Error{Code: "invalid_request", Message: "this choice is not in the question"}
	errAlreadyAnswered = Error{Code: "already_answered", Message: "you already answered this question"}
)

// learnCouple loads the family's state and the acting and other parent.
func (s *Server) learnCouple(ctx context.Context, familyID, me uuid.UUID) (content.State, learn.Couple, together.Other, []uuid.UUID, error) {
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return st, learn.Couple{}, together.Other{}, nil, err
	}
	parents, err := s.q.ListMembers(ctx, familyID)
	if err != nil {
		return st, learn.Couple{}, together.Other{}, nil, err
	}
	c, other := together.Couple(parents, me)
	ids := make([]uuid.UUID, 0, len(parents))
	for _, p := range parents {
		ids = append(ids, p.ID)
	}
	return st, c, other, ids, nil
}

func (s *Server) ListLearningPaths(ctx context.Context, req ListLearningPathsRequestObject) (ListLearningPathsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListLearningPaths401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListLearningPaths404JSONResponse(errNoMember), nil
	}
	st, c, _, _, err := s.learnCouple(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	paths, err := learn.Paths(ctx, s.pool, familyID, c, st)
	if err != nil {
		return nil, err
	}
	out := LearningPathList{Stage: Stage(st.Stage), Items: make([]LearningPath, 0, len(paths))}
	if st.Stage == "pregnancy" && st.HasWeek {
		w := st.Week
		out.Week = &w
	}
	for _, p := range paths {
		out.Items = append(out.Items, learningPathOut(p))
	}
	return ListLearningPaths200JSONResponse(out), nil
}

func (s *Server) UpdateLessonRead(ctx context.Context, req UpdateLessonReadRequestObject) (UpdateLessonReadResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateLessonRead401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateLessonRead404JSONResponse(errNoMember), nil
	}
	st, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	r, err := learn.UpdateRead(ctx, s.pool, familyID, req.MemberId, st, req.LessonId, req.Body.Finished, s.now(ctx))
	switch {
	case errors.Is(err, learn.ErrUnknownLesson):
		return UpdateLessonRead404JSONResponse(errUnknownLesson), nil
	case errors.Is(err, learn.ErrLocked):
		return UpdateLessonRead409JSONResponse(errLessonLocked), nil
	case err != nil:
		return nil, err
	}
	return UpdateLessonRead200JSONResponse(lessonReadOut(r)), nil
}

func (s *Server) CreateQuizAnswer(ctx context.Context, req CreateQuizAnswerRequestObject) (CreateQuizAnswerResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateQuizAnswer401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateQuizAnswer404JSONResponse(errNoMember), nil
	}
	st, c, _, _, err := s.learnCouple(ctx, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	r, err := learn.AnswerQuestion(ctx, s.pool, familyID, c, st, req.Body.QuestionId, req.Body.ChoiceId, s.now(ctx))
	switch {
	case errors.Is(err, learn.ErrUnknownQuestion):
		return CreateQuizAnswer404JSONResponse(errUnknownQuestion), nil
	case errors.Is(err, learn.ErrLocked):
		return CreateQuizAnswer409JSONResponse(errLessonLocked), nil
	case errors.Is(err, learn.ErrUnknownChoice):
		return CreateQuizAnswer400JSONResponse(errUnknownChoice), nil
	case errors.Is(err, learn.ErrAlreadyAnswered):
		return CreateQuizAnswer409JSONResponse(errAlreadyAnswered), nil
	case err != nil:
		return nil, err
	}
	out := QuizResult{
		QuestionId: r.QuestionID, ChoiceId: r.ChoiceID, Correct: *r.Correct, CorrectChoiceId: r.CorrectChoiceID,
		Explanation: r.Explanation, Source: sourceOut(r.Source),
	}
	if r.Partner != nil {
		a := quizAnswerOut(*r.Partner)
		out.PartnerAnswer = &a
	}
	return CreateQuizAnswer201JSONResponse(out), nil
}

func learningPathOut(p learn.PathView) LearningPath {
	out := LearningPath{Id: p.ID, Title: p.Title, Why: p.Why, Lessons: make([]Lesson, 0, len(p.Lessons)), Progress: make([]PathProgress, 0, len(p.Progress))}
	for _, pr := range p.Progress {
		out.Progress = append(out.Progress, PathProgress{MemberId: pr.MemberID, Started: pr.Started, Finished: pr.Finished})
	}
	for _, l := range p.Lessons {
		out.Lessons = append(out.Lessons, lessonOut(l))
	}
	return out
}

func lessonOut(l learn.LessonView) Lesson {
	out := Lesson{
		Id: l.ID, PathId: l.PathID, Title: l.Title, Body: l.Body, Minutes: l.Minutes,
		Audience: make([]GuideAudience, 0, len(l.Audience)), Locked: l.State.Locked, Timing: LessonTiming(l.State.Timing),
		Source: sourceOut(l.Source), ExtraSources: make([]Source, 0, len(l.ExtraSources)), UrgentHelpLink: l.UrgentHelpLink,
		Reads: make([]LessonRead, 0, len(l.Reads)), Quiz: make([]QuizQuestion, 0, len(l.Quiz)),
	}
	if l.State.InPregnancy {
		from, to, unlocks := l.WeekFrom, l.WeekTo, l.UnlocksAtWeek()
		out.WeekFrom, out.WeekTo, out.UnlocksAtWeek = &from, &to, &unlocks
	}
	for _, a := range l.Audience {
		out.Audience = append(out.Audience, GuideAudience(a))
	}
	for _, src := range l.ExtraSources {
		out.ExtraSources = append(out.ExtraSources, sourceOut(src))
	}
	if l.TalkPrompt != "" {
		p := l.TalkPrompt
		out.TalkPrompt = &p
	}
	if l.TalkedAt != nil {
		at := l.TalkedAt.UTC()
		out.TalkedAt = &at
	}
	for _, r := range l.Reads {
		out.Reads = append(out.Reads, lessonReadOut(r))
	}
	for _, q := range l.Quiz {
		qq := QuizQuestion{Id: q.ID, LessonId: q.LessonID, Prompt: q.Prompt, Choices: make([]SimulatorChoice, 0, len(q.Choices)), Answers: make([]QuizAnswer, 0, len(q.Answers))}
		for _, ch := range q.Choices {
			qq.Choices = append(qq.Choices, SimulatorChoice{Id: ch.ID, Text: ch.Text})
		}
		for _, a := range q.Answers {
			qq.Answers = append(qq.Answers, quizAnswerOut(a))
		}
		if q.Revealed {
			right, why := q.CorrectChoiceID, q.Explanation
			qq.CorrectChoiceId, qq.Explanation = &right, &why
		}
		out.Quiz = append(out.Quiz, qq)
	}
	return out
}

func lessonReadOut(r learn.Read) LessonRead {
	out := LessonRead{MemberId: r.MemberID, LessonId: r.LessonID, StartedAt: r.StartedAt.UTC()}
	if r.FinishedAt != nil {
		t := r.FinishedAt.UTC()
		out.FinishedAt = &t
	}
	return out
}

func quizAnswerOut(a learn.Answer) QuizAnswer {
	out := QuizAnswer{MemberId: a.MemberID, AnsweredAt: a.AnsweredAt.UTC(), Correct: a.Correct}
	if a.ChoiceID != "" {
		c := a.ChoiceID
		out.ChoiceId = &c
	}
	return out
}
