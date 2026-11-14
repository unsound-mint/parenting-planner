package httpapi

import (
	"context"
	"errors"
	"math"

	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/fertility"
)

var (
	errNoFertilityEntry = Error{Code: "not_found", Message: "no such entry"}
	errNoChecklistItem  = Error{Code: "not_found", Message: "no such checklist item"}
	errFertilityShare   = Error{Code: "invalid_request", Message: "visibility must be private or partner"}
)

func fertilityInvalid(err error) (Error, bool) {
	var inv fertility.Invalid
	switch {
	case errors.As(err, &inv):
		return Error{Code: "invalid_request", Message: inv.Error()}, true
	case errors.Is(err, fertility.ErrNotShare):
		return errFertilityShare, true
	}
	return Error{}, false
}

func fertilityEntryOut(e fertility.Entry) FertilityEntry {
	out := FertilityEntry{
		Id: e.ID, AuthorId: e.OwnerMemberID, Kind: FertilityKind(e.Kind), Date: apiDate(e.EntryDate),
		Visibility: FertilityVisibility(e.Visibility), CreatedAt: e.CreatedAt, Code: e.Code,
	}
	if e.TempC != nil {
		t := float32(*e.TempC)
		out.TempC = &t
	}
	if e.Note != "" {
		n := e.Note
		out.Note = &n
	}
	return out
}

func (s *Server) CreateFertilityEntry(ctx context.Context, req CreateFertilityEntryRequestObject) (CreateFertilityEntryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateFertilityEntry401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateFertilityEntry404JSONResponse(errNoMember), nil
	}
	b := req.Body
	in := fertility.New{Kind: string(b.Kind), Date: dateOf(b.Date.Time), Code: b.Code, Visibility: access.Visibility(b.Visibility)}
	if b.Note != nil {
		in.Note = *b.Note
	}
	if b.TempC != nil {
		t := math.Round(float64(*b.TempC)*100) / 100
		in.TempC = &t
	}
	e, err := fertility.Create(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, in, s.today(ctx))
	if bad, ok := fertilityInvalid(err); ok {
		return CreateFertilityEntry400JSONResponse(bad), nil
	}
	if err != nil {
		return nil, err
	}
	return CreateFertilityEntry201JSONResponse(fertilityEntryOut(e)), nil
}

func (s *Server) ListFertilityEntries(ctx context.Context, req ListFertilityEntriesRequestObject) (ListFertilityEntriesResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListFertilityEntries401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListFertilityEntries404JSONResponse(errNoMember), nil
	}
	rows, err := fertility.List(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, s.today(ctx))
	if err != nil {
		return nil, err
	}
	out := FertilityEntryList{Items: make([]FertilityEntry, 0, len(rows))}
	for _, r := range rows {
		out.Items = append(out.Items, fertilityEntryOut(r))
	}
	return ListFertilityEntries200JSONResponse(out), nil
}

func (s *Server) UpdateFertilityEntry(ctx context.Context, req UpdateFertilityEntryRequestObject) (UpdateFertilityEntryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateFertilityEntry401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateFertilityEntry404JSONResponse(errNoMember), nil
	}
	e, err := fertility.Update(ctx, s.pool, s.cfg.Diary, familyID, req.MemberId, req.EntryId, access.Visibility(req.Body.Visibility))
	if bad, ok := fertilityInvalid(err); ok {
		return UpdateFertilityEntry400JSONResponse(bad), nil
	}
	if errors.Is(err, fertility.ErrNoEntry) {
		return UpdateFertilityEntry404JSONResponse(errNoFertilityEntry), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateFertilityEntry200JSONResponse(fertilityEntryOut(e)), nil
}

func (s *Server) DeleteFertilityEntry(ctx context.Context, req DeleteFertilityEntryRequestObject) (DeleteFertilityEntryResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteFertilityEntry401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteFertilityEntry404JSONResponse(errNoMember), nil
	}
	err = fertility.Delete(ctx, s.pool, familyID, req.MemberId, req.EntryId)
	if errors.Is(err, fertility.ErrNoEntry) {
		return DeleteFertilityEntry404JSONResponse(errNoFertilityEntry), nil
	}
	if err != nil {
		return nil, err
	}
	return DeleteFertilityEntry204Response{}, nil
}

func (s *Server) GetFertilityOverview(ctx context.Context, req GetFertilityOverviewRequestObject) (GetFertilityOverviewResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetFertilityOverview401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetFertilityOverview404JSONResponse(errNoMember), nil
	}
	ov, err := fertility.ReadOverview(ctx, s.pool, familyID, req.MemberId, m.BirthDate, s.today(ctx))
	if err != nil {
		return nil, err
	}
	out := FertilityOverview{Cycles: make([]FertilityCycle, 0, len(ov.Cycles)), Sources: []Source{}}
	for _, c := range ov.Cycles {
		fc := FertilityCycle{StartDate: apiDate(c.Start)}
		if c.Length > 0 {
			l := c.Length
			fc.LengthDays = &l
		}
		out.Cycles = append(out.Cycles, fc)
	}
	if ov.CycleDay > 0 {
		d := ov.CycleDay
		out.CycleDay = &d
	}
	if e := ov.Estimate; e.Ready {
		out.Estimate = &FertilityEstimate{
			AverageCycleDays: e.AverageDays, ShortestCycleDays: e.ShortestDays, LongestCycleDays: e.LongestDays,
			SpreadDays: e.SpreadDays, CyclesUsed: e.CyclesUsed, NextPeriod: apiDate(e.NextPeriod),
			Ovulation: apiDate(e.Ovulation), WindowStart: apiDate(e.WindowStart), WindowEnd: apiDate(e.WindowEnd),
		}
	} else if e.CyclesNeeded > 0 {
		n := e.CyclesNeeded
		out.CyclesNeeded = &n
	}
	out.Clinician = ClinicianHint{ThresholdMonths: ov.Clinician.ThresholdMonths, Suggest: ov.Clinician.Suggest}
	if ov.Clinician.MonthsTrying > 0 || ov.Clinician.Suggest {
		mt := ov.Clinician.MonthsTrying
		out.Clinician.MonthsTrying = &mt
	}
	for _, src := range fertility.OverviewSources {
		out.Sources = append(out.Sources, ruleSourceOut(src))
	}
	return GetFertilityOverview200JSONResponse(out), nil
}

func checklistOut(c fertility.Checklist) PreconceptionChecklist {
	out := PreconceptionChecklist{Items: make([]PreconceptionItem, 0, len(c.Items)), Done: c.Done, PartnerShared: c.PartnerShared}
	for _, it := range c.Items {
		if !it.PartnerOnly {
			out.Total++
		}
		pi := PreconceptionItem{
			Key: it.Key, Group: PreconceptionGroup(it.Group), Title: it.Title, Detail: it.Detail,
			Source: ruleSourceOut(it.Source), Done: it.Done, PartnerDone: it.PartnerDone,
		}
		if it.PartnerOnly {
			yes := true
			pi.PartnerOnly = &yes
		}
		if it.Done {
			at := it.DoneAt
			v := FertilityVisibility(it.Visibility)
			pi.DoneAt, pi.Visibility = &at, &v
		}
		out.Items = append(out.Items, pi)
	}
	return out
}

func (s *Server) GetPreconceptionChecklist(ctx context.Context, req GetPreconceptionChecklistRequestObject) (GetPreconceptionChecklistResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetPreconceptionChecklist401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetPreconceptionChecklist404JSONResponse(errNoMember), nil
	}
	c, err := fertility.ReadChecklist(ctx, s.pool, familyID, req.MemberId, m.Role)
	if err != nil {
		return nil, err
	}
	return GetPreconceptionChecklist200JSONResponse(checklistOut(c)), nil
}

func (s *Server) SetPreconceptionItem(ctx context.Context, req SetPreconceptionItemRequestObject) (SetPreconceptionItemResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return SetPreconceptionItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return SetPreconceptionItem404JSONResponse(errNoMember), nil
	}
	v := access.Private
	if req.Body.Visibility != nil {
		v = access.Visibility(*req.Body.Visibility)
	}
	c, err := fertility.SetTick(ctx, s.pool, familyID, req.MemberId, m.Role, req.ItemKey, req.Body.Done, v, s.now(ctx))
	if bad, ok := fertilityInvalid(err); ok {
		return SetPreconceptionItem400JSONResponse(bad), nil
	}
	if errors.Is(err, fertility.ErrNoItem) {
		return SetPreconceptionItem404JSONResponse(errNoChecklistItem), nil
	}
	if err != nil {
		return nil, err
	}
	return SetPreconceptionItem200JSONResponse(checklistOut(c)), nil
}

func settingsOut(st fertility.Settings) JourneySettings {
	out := JourneySettings{HideBabyContent: st.HideBabyContent, FertilityTreatment: st.FertilityTreatment, PreviousLoss: st.PreviousLoss}
	if st.TryingSince != nil {
		d := apiDate(*st.TryingSince)
		out.TryingSince = &d
	}
	return out
}

func (s *Server) GetJourneySettings(ctx context.Context, req GetJourneySettingsRequestObject) (GetJourneySettingsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetJourneySettings401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetJourneySettings404JSONResponse(errNoMember), nil
	}
	st, err := fertility.ReadSettings(ctx, s.pool, familyID, req.MemberId)
	if err != nil {
		return nil, err
	}
	return GetJourneySettings200JSONResponse(settingsOut(st)), nil
}

func (s *Server) UpdateJourneySettings(ctx context.Context, req UpdateJourneySettingsRequestObject) (UpdateJourneySettingsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateJourneySettings401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateJourneySettings404JSONResponse(errNoMember), nil
	}
	b := req.Body
	in := fertility.Settings{HideBabyContent: b.HideBabyContent, FertilityTreatment: b.FertilityTreatment, PreviousLoss: b.PreviousLoss}
	if b.TryingSince != nil {
		d := dateOf(b.TryingSince.Time)
		in.TryingSince = &d
	}
	st, err := fertility.SaveSettings(ctx, s.pool, familyID, req.MemberId, in, s.today(ctx), s.now(ctx))
	if bad, ok := fertilityInvalid(err); ok {
		return UpdateJourneySettings400JSONResponse(bad), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateJourneySettings200JSONResponse(settingsOut(st)), nil
}
