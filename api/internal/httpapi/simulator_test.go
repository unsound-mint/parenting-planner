package httpapi_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func TestSimulatorRoundsScoreAndAdapt(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	member := func(role httpapi.ParentRole) string {
		return "/api/members/" + testutil.Parent(t, fam, role).Id.String()
	}
	mother, partner := member(httpapi.ParentRoleMother), member(httpapi.ParentRolePartner)
	var progress httpapi.SimulatorProgress
	c.Get(mother+"/simulator", http.StatusOK, &progress)
	if len(progress.Scenarios) != 2 || progress.RoundsCompleted != 0 || len(progress.WeakSpots) != 0 {
		t.Fatalf("unexpected fresh progress: %+v", progress)
	}
	c.Post(mother+"/simulator-rounds", map[string]string{"mode": "practice"}, http.StatusConflict, nil)
	c.Post(mother+"/simulator-rounds", map[string]string{"mode": "scenario"}, http.StatusBadRequest, nil)
	c.Post(mother+"/simulator-rounds", map[string]string{"mode": "scenario", "scenarioId": "unknown"}, http.StatusNotFound, nil)
	var round httpapi.SimulatorRound
	c.Post(mother+"/simulator-rounds", map[string]string{"mode": "scenario", "scenarioId": "first-night-home"}, http.StatusCreated, &round)
	if len(round.Questions) != 3 || round.Completed || round.Result != nil {
		t.Fatalf("unexpected new round: %+v", round)
	}
	for _, q := range round.Questions {
		if q.Answer != nil {
			t.Fatal("answer exposed before submission")
		}
	}
	roundPath := "/simulator-rounds/" + round.Id.String()
	c.Get(partner+roundPath, http.StatusNotFound, nil)
	c.Post(partner+roundPath+"/answers", map[string]string{"questionId": "feed-cues", "choiceId": "a"}, http.StatusNotFound, nil)
	other := testutil.New(t)
	other.StartDemo("pregnancy")
	other.Get(mother+roundPath, http.StatusNotFound, nil)

	answer := func(question, choice string, status int) httpapi.SimulatorAnswerResult {
		var result httpapi.SimulatorAnswerResult
		var out any
		if status == http.StatusCreated {
			out = &result
		}
		c.Post(mother+roundPath+"/answers", map[string]string{"questionId": question, "choiceId": choice}, status, out)
		return result
	}
	answer("not-in-round", "a", http.StatusBadRequest)
	answer("feed-cues", "d", http.StatusBadRequest)
	result := answer("feed-cues", "a", http.StatusCreated)
	if !result.Correct || result.Source == nil || result.RoundCompleted == nil || *result.RoundCompleted {
		t.Fatalf("first answer: %+v", result)
	}
	answer("feed-cues", "b", http.StatusConflict)
	answer("safe-surface", "b", http.StatusCreated)
	result = answer("fever", "a", http.StatusCreated)
	if result.Correct || result.RoundCompleted == nil || !*result.RoundCompleted {
		t.Fatalf("last answer: %+v", result)
	}
	c.Get(mother+roundPath, http.StatusOK, &round)
	if !round.Completed || round.Result == nil || round.Result.Correct != 2 || round.Result.SuggestedShift == nil ||
		!slices.Equal(round.Result.WeakSpots, []httpapi.SimulatorSkill{"warning_signs"}) {
		t.Fatalf("finished round: %+v", round)
	}
	c.Get(mother+"/simulator", http.StatusOK, &progress)
	if progress.RoundsCompleted != 1 || !slices.Equal(progress.WeakSpots, []httpapi.SimulatorSkill{"warning_signs"}) {
		t.Fatalf("mother progress: %+v", progress)
	}
	c.Get(partner+"/simulator", http.StatusOK, &progress)
	if progress.RoundsCompleted != 0 || len(progress.WeakSpots) != 0 {
		t.Fatalf("partner inherited mother's scores: %+v", progress)
	}
	c.Post(mother+"/simulator-rounds", map[string]string{"mode": "practice"}, http.StatusCreated, &round)
	if len(round.Questions) == 0 || round.Questions[0].Id != "fever" {
		t.Fatalf("practice did not prioritize missed question: %+v", round)
	}
	var audits int
	err := c.Pool.QueryRow(t.Context(), "SELECT count(*) FROM audit_log WHERE family_id=$1 AND entity='simulator_round'", fam.Id).Scan(&audits)
	if err != nil || audits < 8 {
		t.Fatalf("simulator audits: %d, error: %v", audits, err)
	}
}

func TestSimulatorRequiresSession(t *testing.T) {
	c := testutil.New(t)
	c.Get("/api/members/00000000-0000-4000-8000-000000000001/simulator", http.StatusUnauthorized, nil)
}
