package httpapi

import (
	"context"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/admin"
	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
)

var errNotPregnant = Error{Code: "not_pregnant", Message: "the family is not pregnant"}

func (s *Server) ListGuides(ctx context.Context, req ListGuidesRequestObject) (ListGuidesResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListGuides401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListGuides404JSONResponse(errNoMember), nil
	}
	state, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var want content.Kind
	if req.Params.Kind != nil {
		want = content.Kind(*req.Params.Kind)
	}
	edits, err := admin.Edits(ctx, s.q, familyID)
	if err != nil {
		return nil, err
	}
	entries := content.Guides(state, content.Viewer{Role: m.Role}, want)
	out := GuideList{Items: make([]Guide, 0, len(entries))}
	for _, e := range entries {
		out.Items = append(out.Items, guideOut(edits.Guide(e)))
	}
	return ListGuides200JSONResponse(out), nil
}

func (s *Server) GetPregnancyWeek(ctx context.Context, req GetPregnancyWeekRequestObject) (GetPregnancyWeekResponseObject, error) {
	familyID, viewer, state, deny, err := s.pregnancyReader(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case deny == pregnancyNoSession:
		return GetPregnancyWeek401JSONResponse(errNoSession), nil
	case deny == pregnancyNoMember:
		return GetPregnancyWeek404JSONResponse(errNoMember), nil
	case deny == pregnancyForbidden:
		return GetPregnancyWeek403JSONResponse(errForbidden), nil
	case deny == pregnancyNotPregnant:
		return GetPregnancyWeek409JSONResponse(errNotPregnant), nil
	}
	card, ok := content.WeekCard(req.Week, viewer, state.Week)
	if !ok {
		// The contract limits week to 4..40, so this is unreachable.
		return GetPregnancyWeek400JSONResponse(Error{Code: "invalid_request", Message: "week must be 4 to 40"}), nil
	}
	edits, err := admin.Edits(ctx, s.q, familyID)
	if err != nil {
		return nil, err
	}
	card = edits.Card(card)
	out := PregnancyWeek{
		Week: card.Week, IsCurrentWeek: card.Week == state.Week, WhyItMatters: card.WhyItMatters,
		Tasks: card.Tasks, Questions: card.Questions, BirthPrep: make([]Guide, 0, len(card.BirthPrep)),
		Source: sourceOut(card.Source), Development: &card.Development,
	}
	out.Size = sizeOut(card.Size)
	for _, e := range card.BirthPrep {
		out.BirthPrep = append(out.BirthPrep, guideOut(e))
	}
	return GetPregnancyWeek200JSONResponse(out), nil
}

func (s *Server) GetPregnancyGrowth(ctx context.Context, req GetPregnancyGrowthRequestObject) (GetPregnancyGrowthResponseObject, error) {
	_, _, state, deny, err := s.pregnancyReader(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case deny == pregnancyNoSession:
		return GetPregnancyGrowth401JSONResponse(errNoSession), nil
	case deny == pregnancyNoMember, deny == pregnancyForbidden:
		// actingMember already answers 404 for a caregiver, so a parent always passes MayReadPregnancy.
		return GetPregnancyGrowth404JSONResponse(errNoMember), nil
	case deny == pregnancyNotPregnant:
		return GetPregnancyGrowth409JSONResponse(errNotPregnant), nil
	}
	weeks := content.GrowthWeeks()
	out := PregnancyGrowth{CurrentWeek: min(max(state.Week, content.MinWeek), content.MaxWeek), Weeks: make([]PregnancyGrowthWeek, 0, len(weeks))}
	for _, w := range weeks {
		g := PregnancyGrowthWeek{Week: w.Week, Size: *sizeOut(w.Size), Hotspots: make([]GrowthHotspot, 0, len(w.Hotspots))}
		for _, h := range w.Hotspots {
			g.Hotspots = append(g.Hotspots, GrowthHotspot{Area: GrowthHotspotArea(h.Area), Text: h.Text, Sources: []Source{sourceOut(h.Source)}})
		}
		out.Weeks = append(out.Weeks, g)
	}
	return GetPregnancyGrowth200JSONResponse(out), nil
}

type pregnancyDenial int

const (
	pregnancyAllowed pregnancyDenial = iota
	pregnancyNoSession
	pregnancyNoMember
	pregnancyForbidden
	pregnancyNotPregnant
)

// pregnancyReader is the shared gate for pregnancy content (the weekly card and
// the 3D growth view): the acting member must be allowed to read pregnancy
// content, and the family must be pregnant with a known week. Pregnancy loss
// support moves the family to planning, so it lands on pregnancyNotPregnant.
func (s *Server) pregnancyReader(ctx context.Context, memberID uuid.UUID) (uuid.UUID, content.Viewer, content.State, pregnancyDenial, error) {
	familyID, m, kind, err := s.actingMember(ctx, memberID)
	switch {
	case err != nil:
		return familyID, content.Viewer{}, content.State{}, pregnancyAllowed, err
	case kind == errUnauthorized:
		return familyID, content.Viewer{}, content.State{}, pregnancyNoSession, nil
	case kind == errNotFound:
		return familyID, content.Viewer{}, content.State{}, pregnancyNoMember, nil
	}
	viewer := content.Viewer{Role: m.Role}
	if !viewer.MayReadPregnancy() {
		return familyID, viewer, content.State{}, pregnancyForbidden, nil
	}
	state, _, err := s.contentState(ctx, familyID)
	if err != nil {
		return familyID, viewer, state, pregnancyAllowed, err
	}
	if state.Stage != "pregnancy" || !state.HasWeek {
		return familyID, viewer, state, pregnancyNotPregnant, nil
	}
	return familyID, viewer, state, pregnancyAllowed, nil
}

// contentState reads the family's stage, gestational week and youngest child's age.
func (s *Server) contentState(ctx context.Context, familyID uuid.UUID) (content.State, bool, error) {
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return content.State{}, false, err
	}
	kids, err := s.q.ListChildren(ctx, familyID)
	if err != nil {
		return content.State{}, false, err
	}
	today := s.today(ctx)
	st := content.State{Stage: fam.Stage}
	st.Week, st.HasWeek = rules.Facts{Today: today, Stage: fam.Stage, DueDate: fam.DueDate}.GestationalWeek()
	if n := len(kids); n > 0 {
		// ListChildren is oldest first; the youngest decides the content.
		st.HasChild, st.AgeMonths = true, monthsBetween(kids[n-1].BirthDate, today)
		// The stored stage is set once (at sign-up or "Baby is home") and does
		// not move as the child grows, so after a birth the age decides: a
		// child who turned one on the demo clock gets toddler content.
		st.Stage = content.StageAfterBirth(fam.Stage, st.AgeMonths)
	}
	return st, true, nil
}

func sourceOut(s content.Source) Source {
	return Source{Title: s.Title, Url: s.URL, CheckedAt: openapi_types.Date{Time: s.CheckedAt}}
}

func guideOut(e content.Entry) Guide {
	g := Guide{
		Id: e.ID, Kind: GuideKind(e.Kind), Title: e.Title, Summary: e.Summary, Steps: e.Steps,
		Stages: make([]Stage, 0, len(e.Stages)), Audience: make([]GuideAudience, 0, len(e.Audience)),
		Locked: e.Locked, Source: sourceOut(e.Source),
	}
	if e.Minutes > 0 {
		g.Minutes = &e.Minutes
	}
	if e.RuleID != "" {
		id := e.RuleID
		g.RuleId = &id
	}
	if e.Action != nil {
		g.Action = guideActionOut(e.Action)
	}
	for _, st := range e.Stages {
		g.Stages = append(g.Stages, Stage(st))
	}
	for _, a := range e.Audience {
		g.Audience = append(g.Audience, GuideAudience(a))
	}
	if e.Weeks != nil {
		g.WeekFrom, g.WeekTo = &e.Weeks.From, &e.Weeks.To
	}
	if e.Ages != nil {
		g.AgeMonthsFrom, g.AgeMonthsTo = &e.Ages.From, &e.Ages.To
	}
	if e.Kind == content.BirthPrep {
		unlock := content.BirthPrepUnlockWeek
		g.UnlocksAtWeek = &unlock
	}
	return g
}

func guideActionOut(a *content.Action) *GuideAction {
	out := GuideAction{Kind: GuideActionKind(a.Kind)}
	if a.Label != "" {
		out.Label = &a.Label
	}
	if a.Title != "" {
		out.Title = &a.Title
	}
	if a.Question != "" {
		out.Question = &a.Question
	}
	if a.Shift != nil {
		days := make([]Weekday, 0, len(a.Shift.Days))
		for _, d := range a.Shift.Days {
			days = append(days, Weekday(d))
		}
		out.Shift = &ShiftSuggestion{Title: a.Shift.Title, Days: days, StartTime: a.Shift.StartTime, EndTime: a.Shift.EndTime}
	}
	return &out
}

// sizeOut maps the catalog size to the contract. Weight is left out where no source gives one.
func sizeOut(sz content.Size) *BabySize {
	out := &BabySize{
		Comparison: sz.Comparison, LengthCm: float32(sz.LengthCm), LengthMeasure: BabySizeLengthMeasure(sz.LengthMeasure),
		Sources: make([]Source, 0, len(sz.Sources)),
	}
	if sz.HasWeight() {
		w := float32(sz.WeightG)
		r := []float32{float32(sz.WeightRangeG[0]), float32(sz.WeightRangeG[1])}
		out.WeightG, out.WeightRangeG = &w, &r
	}
	for _, s := range sz.Sources {
		out.Sources = append(out.Sources, sourceOut(s))
	}
	return out
}

var (
	errNowPregnant = Error{Code: "pregnant", Message: "the family is pregnant, use the pregnancy week"}
	errNowNoChild  = Error{Code: "no_child", Message: "no child is on record yet"}
)

func (s *Server) GetStageNow(ctx context.Context, req GetStageNowRequestObject) (GetStageNowResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetStageNow401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetStageNow404JSONResponse(errNoMember), nil
	}
	fam, err := s.q.GetFamily(ctx, familyID)
	if err != nil {
		return nil, err
	}
	var line content.NowLine
	switch fam.Stage {
	case "pregnancy":
		return GetStageNow409JSONResponse(errNowPregnant), nil
	case "planning", "trying":
		line, _ = content.NowForPlanning(fam.Stage, s.today(ctx))
	default:
		kids, err := s.q.ListChildren(ctx, familyID)
		if err != nil {
			return nil, err
		}
		if len(kids) == 0 {
			return GetStageNow409JSONResponse(errNowNoChild), nil
		}
		// ListChildren is oldest first; the youngest decides the content.
		line = content.NowForChild(kids[len(kids)-1].BirthDate, s.today(ctx))
	}
	out := StageNow{
		Stage: JourneyStage(line.Stage), Period: line.Period, Headline: line.Headline, Detail: line.Detail,
		PlayIdea: line.PlayIdea, Note: line.Note, Sources: make([]Source, 0, len(line.Sources)),
	}
	for _, src := range line.Sources {
		out.Sources = append(out.Sources, sourceOut(src))
	}
	return GetStageNow200JSONResponse(out), nil
}

func adviceOut(a content.SafetyAdvice) SafetyAdvice {
	return SafetyAdvice{Status: SafetyAdviceStatus(a.Status), Why: a.Why}
}

func (s *Server) ListSafetyReference(ctx context.Context, req ListSafetyReferenceRequestObject) (ListSafetyReferenceResponseObject, error) {
	_, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListSafetyReference401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListSafetyReference404JSONResponse(errNoMember), nil
	}
	entries := content.SafetyReference()
	out := SafetyReferenceList{Items: make([]SafetyEntry, 0, len(entries))}
	for _, e := range entries {
		item := SafetyEntry{
			Id: e.ID, Category: SafetyEntryCategory(e.Category), Topic: e.Topic, Name: e.Name, Aliases: e.Aliases,
			Pregnancy: adviceOut(e.Preg), Sources: make([]Source, 0, len(e.Sources)),
		}
		if e.Breast != nil {
			b := adviceOut(*e.Breast)
			item.Breastfeeding = &b
		}
		if e.Ask != "" {
			item.Ask = &e.Ask
		}
		if e.Learn != nil {
			item.Learn = &SafetyLearnLink{PathId: e.Learn.PathID, LessonId: e.Learn.LessonID}
		}
		for _, src := range e.Sources {
			item.Sources = append(item.Sources, sourceOut(src))
		}
		out.Items = append(out.Items, item)
	}
	return ListSafetyReference200JSONResponse(out), nil
}
