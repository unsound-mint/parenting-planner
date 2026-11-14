package httpapi

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/money"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Money pack: budget, birth cost plan, childcare list. Parents only: a caregiver's
// session fails actingMember and gets the same 404 as an unknown person.

func moneySource(s money.Source) Source {
	return Source{Title: s.Title, Url: s.URL, CheckedAt: apiDate(money.CheckedAt)}
}

func totalOut(t money.Total) BudgetTotal {
	return BudgetTotal{OneTimeCents: t.OneTime, MonthlyCents: t.Monthly, FirstYearCents: t.FirstYear}
}

func budgetItemOut(it store.BudgetItem) BudgetItem {
	return BudgetItem{
		Id: it.ID, Category: BudgetCategory(it.Category), Name: it.Name, AmountCents: it.AmountCents,
		Cadence: BudgetCadence(it.Cadence), Payer: BudgetPayer(it.Payer),
	}
}

func budgetOut(b money.Budget) Budget {
	out := Budget{
		Items: make([]BudgetItem, 0, len(b.Items)), Total: totalOut(b.Total),
		ByCategory: make([]BudgetCategoryTotal, 0, len(b.ByCategory)), ByPayer: make([]BudgetPayerTotal, 0, 3),
		Suggestions: make([]BudgetSuggestion, 0, len(b.Suggestions)),
	}
	for _, it := range b.Items {
		out.Items = append(out.Items, budgetItemOut(it))
	}
	for _, c := range b.ByCategory {
		out.ByCategory = append(out.ByCategory, BudgetCategoryTotal{
			Category: BudgetCategory(c.Category), OneTimeCents: c.OneTime, MonthlyCents: c.Monthly, FirstYearCents: c.FirstYear,
		})
	}
	for _, p := range b.ByPayer {
		out.ByPayer = append(out.ByPayer, BudgetPayerTotal{
			Payer: BudgetPayer(p.Payer), OneTimeCents: p.OneTime, MonthlyCents: p.Monthly, FirstYearCents: p.FirstYear,
		})
	}
	for _, s := range b.Suggestions {
		sg := BudgetSuggestion{
			Category: BudgetCategory(s.Category), Name: s.Name, AmountCents: s.AmountCents,
			Cadence: BudgetCadence(s.Cadence), Payer: BudgetPayer(s.Payer),
		}
		if s.Source != nil {
			src := moneySource(*s.Source)
			sg.Source = &src
		}
		out.Suggestions = append(out.Suggestions, sg)
	}
	return out
}

func newItem(b BudgetItemInput) money.NewItem {
	return money.NewItem{Category: string(b.Category), Name: b.Name, Cadence: string(b.Cadence), Payer: string(b.Payer), AmountCents: b.AmountCents}
}

func (s *Server) GetBudget(ctx context.Context, req GetBudgetRequestObject) (GetBudgetResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetBudget401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetBudget404JSONResponse(errNoMember), nil
	}
	b, err := money.GetBudget(ctx, s.pool, familyID)
	if err != nil {
		return nil, err
	}
	return GetBudget200JSONResponse(budgetOut(b)), nil
}

func (s *Server) CreateBudgetItem(ctx context.Context, req CreateBudgetItemRequestObject) (CreateBudgetItemResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateBudgetItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateBudgetItem404JSONResponse(errNoMember), nil
	}
	it, err := money.CreateItem(ctx, s.pool, familyID, m.ID, newItem(*req.Body))
	if err != nil {
		return nil, err
	}
	return CreateBudgetItem201JSONResponse(budgetItemOut(it)), nil
}

func (s *Server) UpdateBudgetItem(ctx context.Context, req UpdateBudgetItemRequestObject) (UpdateBudgetItemResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateBudgetItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateBudgetItem404JSONResponse(errNoMember), nil
	}
	it, err := money.UpdateItem(ctx, s.pool, familyID, req.ItemId, newItem(*req.Body))
	if errors.Is(err, money.ErrNotFound) {
		return UpdateBudgetItem404JSONResponse(errNoItem), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateBudgetItem200JSONResponse(budgetItemOut(it)), nil
}

func (s *Server) DeleteBudgetItem(ctx context.Context, req DeleteBudgetItemRequestObject) (DeleteBudgetItemResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteBudgetItem401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteBudgetItem404JSONResponse(errNoMember), nil
	}
	err = money.DeleteItem(ctx, s.pool, familyID, req.ItemId)
	if errors.Is(err, money.ErrNotFound) {
		return DeleteBudgetItem404JSONResponse(errNoItem), nil
	}
	if err != nil {
		return nil, err
	}
	return DeleteBudgetItem204Response{}, nil
}

var errNoItem = Error{Code: "not_found", Message: "no such item in this family"}

func birthCostPlanOut(in *money.CostInput) BirthCostPlan {
	out := BirthCostPlan{
		EstimateNote: money.EstimateNote, Scenarios: []BirthCostScenario{},
		BillingLines: money.BillingLines, Questions: money.Questions,
		Sources: []Source{moneySource(money.PetersonKFF), moneySource(money.HealthCareSEP)},
	}
	out.Enrollment.Summary = money.EnrollmentSummary
	out.Enrollment.Source = moneySource(money.HealthCareSEP)
	out.ReferenceOutOfPocket = &struct {
		CesareanCents int64 `json:"cesareanCents"`
		NewbornCents  int64 `json:"newbornCents"`
		VaginalCents  int64 `json:"vaginalCents"`
	}{CesareanCents: money.RefOOPCesarean, NewbornCents: money.RefOOPNewborn, VaginalCents: money.RefOOPVaginal}
	if in == nil {
		return out
	}
	out.Input = &BirthCostInput{
		DeductibleCents: in.DeductibleCents, OutOfPocketMaxCents: in.OutOfPocketMaxCents,
		CoinsurancePercent: int(in.CoinsurancePercent), AlreadyPaidCents: in.AlreadyPaidCents,
	}
	r := func(x money.Range) BirthCostRange { return BirthCostRange{LowCents: x.Low, HighCents: x.High} }
	for _, sc := range money.Estimate(*in) {
		out.Scenarios = append(out.Scenarios, BirthCostScenario{
			Kind: BirthCostScenarioKind(sc.Kind), TypicalBilledCents: sc.TypicalBilled,
			Birth: r(sc.Birth), Newborn: r(sc.Newborn), Total: r(sc.Total), HitsMaximum: sc.HitsMaximum,
		})
	}
	return out
}

func (s *Server) GetBirthCostPlan(ctx context.Context, req GetBirthCostPlanRequestObject) (GetBirthCostPlanResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetBirthCostPlan401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetBirthCostPlan404JSONResponse(errNoMember), nil
	}
	in, err := money.GetCostInput(ctx, s.pool, familyID)
	if err != nil {
		return nil, err
	}
	return GetBirthCostPlan200JSONResponse(birthCostPlanOut(in)), nil
}

func (s *Server) UpdateBirthCostPlan(ctx context.Context, req UpdateBirthCostPlanRequestObject) (UpdateBirthCostPlanResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateBirthCostPlan401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateBirthCostPlan404JSONResponse(errNoMember), nil
	}
	b := req.Body
	in := money.CostInput{
		DeductibleCents: b.DeductibleCents, OutOfPocketMaxCents: b.OutOfPocketMaxCents,
		CoinsurancePercent: int64(b.CoinsurancePercent), AlreadyPaidCents: b.AlreadyPaidCents,
	}
	if in.OutOfPocketMaxCents < in.DeductibleCents {
		return UpdateBirthCostPlan400JSONResponse(errBadCostPlan), nil
	}
	if err := money.SaveCostInput(ctx, s.pool, familyID, m.ID, in, s.now(ctx)); err != nil {
		return nil, err
	}
	return UpdateBirthCostPlan200JSONResponse(birthCostPlanOut(&in)), nil
}

var errBadCostPlan = Error{Code: "bad_plan", Message: "the out-of-pocket maximum cannot be lower than the deductible"}

func childcareOut(o store.ChildcareOption) ChildcareOption {
	out := ChildcareOption{
		Id: o.ID, Name: o.Name, Kind: ChildcareKind(o.Kind), Status: ChildcareStatus(o.Status),
		Contact: o.Contact, Notes: o.Notes,
	}
	if o.MonthlyCostCents.Valid {
		v := o.MonthlyCostCents.Int64
		out.MonthlyCostCents = &v
	}
	if o.ApplicationDeadline != nil {
		d := openapi_types.Date{Time: *o.ApplicationDeadline}
		out.ApplicationDeadline = &d
	}
	if o.WaitlistPosition.Valid {
		v := int(o.WaitlistPosition.Int32)
		out.WaitlistPosition = &v
	}
	return out
}

func newOption(b ChildcareOptionInput) money.NewOption {
	o := money.NewOption{
		Name: b.Name, Kind: string(b.Kind), Status: string(b.Status),
		MonthlyCostCents: b.MonthlyCostCents, Contact: b.Contact, Notes: b.Notes,
	}
	if b.ApplicationDeadline != nil {
		t := b.ApplicationDeadline.Time
		o.ApplicationDeadline = &t
	}
	if b.WaitlistPosition != nil {
		v := int32(*b.WaitlistPosition)
		o.WaitlistPosition = &v
	}
	return o
}

func (s *Server) ListChildcareOptions(ctx context.Context, req ListChildcareOptionsRequestObject) (ListChildcareOptionsResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return ListChildcareOptions401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return ListChildcareOptions404JSONResponse(errNoMember), nil
	}
	rows, err := money.ListOptions(ctx, s.pool, familyID)
	if err != nil {
		return nil, err
	}
	out := ListChildcareOptions200JSONResponse{Items: make([]ChildcareOption, 0, len(rows))}
	for _, o := range rows {
		out.Items = append(out.Items, childcareOut(o))
	}
	out.Benchmark.LowMonthlyCents = money.ChildcareLowMonthly
	out.Benchmark.HighMonthlyCents = money.ChildcareHighMonthly
	out.Benchmark.Source = moneySource(money.DOLChildcare)
	return out, nil
}

func (s *Server) CreateChildcareOption(ctx context.Context, req CreateChildcareOptionRequestObject) (CreateChildcareOptionResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateChildcareOption401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateChildcareOption404JSONResponse(errNoMember), nil
	}
	o, err := money.CreateOption(ctx, s.pool, familyID, m.ID, newOption(*req.Body))
	if err != nil {
		return nil, err
	}
	return CreateChildcareOption201JSONResponse(childcareOut(o)), nil
}

func (s *Server) UpdateChildcareOption(ctx context.Context, req UpdateChildcareOptionRequestObject) (UpdateChildcareOptionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return UpdateChildcareOption401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return UpdateChildcareOption404JSONResponse(errNoMember), nil
	}
	o, err := money.UpdateOption(ctx, s.pool, familyID, req.OptionId, newOption(*req.Body))
	if errors.Is(err, money.ErrNotFound) {
		return UpdateChildcareOption404JSONResponse(errNoItem), nil
	}
	if err != nil {
		return nil, err
	}
	return UpdateChildcareOption200JSONResponse(childcareOut(o)), nil
}

func (s *Server) DeleteChildcareOption(ctx context.Context, req DeleteChildcareOptionRequestObject) (DeleteChildcareOptionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return DeleteChildcareOption401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return DeleteChildcareOption404JSONResponse(errNoMember), nil
	}
	err = money.DeleteOption(ctx, s.pool, familyID, req.OptionId)
	if errors.Is(err, money.ErrNotFound) {
		return DeleteChildcareOption404JSONResponse(errNoItem), nil
	}
	if err != nil {
		return nil, err
	}
	return DeleteChildcareOption204Response{}, nil
}
