package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func missionList(c *testutil.Client, person uuid.UUID) httpapi.MissionList {
	var l httpapi.MissionList
	c.Get(memberPath(person)+"/missions", http.StatusOK, &l)
	return l
}

func findMission(l httpapi.MissionList, key string) *httpapi.Mission {
	for i := range l.Items {
		if l.Items[i].Key == key {
			return &l.Items[i]
		}
	}
	return nil
}

func stickerBook(c *testutil.Client, person uuid.UUID) map[string]httpapi.Sticker {
	var b httpapi.StickerBook
	c.Get(memberPath(person)+"/stickers", http.StatusOK, &b)
	out := map[string]httpapi.Sticker{}
	for _, s := range b.Items {
		out[s.Key] = s
	}
	return out
}

func TestMissionsTakeDoneSwapUseThePlan(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	l := missionList(c, jake.Id)
	if l.Stage != httpapi.MissionListStageSecondTrimester {
		t.Fatalf("week 25 is second trimester, got %s", l.Stage)
	}
	if m := findMission(l, "t2-freezer-meals"); m == nil || m.State != httpapi.MissionStateDone || m.TakenBy == nil || *m.TakenBy != jake.Id || m.Note == nil {
		t.Fatalf("seeded done mission: %+v", m)
	}
	if m := findMission(l, "t2-nursery-corner"); m == nil || m.State != httpapi.MissionStateTaken || m.Source == nil {
		t.Errorf("a taken mission that touches health cites its source: %+v", m)
	}
	if findMission(l, "t3-car-seat") != nil {
		t.Error("third trimester missions are not offered yet")
	}
	// Both parents see the same missions.
	if got := missionList(c, mom.Id); len(got.Items) != len(l.Items) {
		t.Errorf("mother sees %d, partner %d", len(got.Items), len(l.Items))
	}

	// Taking creates a plan task for the taker.
	before := len(taskList(c, jake.Id, ""))
	var m httpapi.Mission
	c.Post(memberPath(mom.Id)+"/missions/t2-tour/take", nil, http.StatusCreated, &m)
	if m.State != httpapi.MissionStateTaken || m.TakenBy == nil || *m.TakenBy != mom.Id || m.TaskId == nil {
		t.Fatalf("taken: %+v", m)
	}
	tasks := taskList(c, jake.Id, "")
	if len(tasks) != before+1 {
		t.Fatalf("taking adds one plan task, %d -> %d", before, len(tasks))
	}
	if task := byTitle(tasks, m.Title); task.AssigneeId != mom.Id {
		t.Errorf("plan task: %+v", task)
	}
	c.Post(memberPath(jake.Id)+"/missions/t2-tour/take", nil, http.StatusConflict, nil)
	c.Post(memberPath(mom.Id)+"/missions/t3-car-seat/take", nil, http.StatusConflict, nil)
	c.Post(memberPath(mom.Id)+"/missions/nope/take", nil, http.StatusNotFound, nil)

	// Finishing ticks the task and keeps the note; twice only updates the note.
	c.Post(memberPath(jake.Id)+"/missions/t2-tour/done", map[string]any{"note": "Built the crib on Sunday."}, http.StatusOK, &m)
	if m.State != httpapi.MissionStateDone || m.Note == nil || *m.Note != "Built the crib on Sunday." || m.DoneBy == nil || *m.DoneBy != jake.Id {
		t.Fatalf("done: %+v", m)
	}
	if task := byTitle(taskList(c, mom.Id, ""), m.Title); !task.Done {
		t.Error("the plan task is ticked")
	}
	c.Post(memberPath(jake.Id)+"/missions/t2-tour/done", map[string]any{"note": strings.Repeat("x", 141)}, http.StatusBadRequest, nil)
	c.Post(memberPath(jake.Id)+"/missions/t2-pediatrician/done", nil, http.StatusConflict, nil) // never taken

	// Swapping an open mission leaves the list; a finished one cannot be put back.
	c.Post(memberPath(mom.Id)+"/missions/t2-pediatrician/swap", nil, http.StatusNoContent, nil)
	if findMission(missionList(c, mom.Id), "t2-pediatrician") != nil {
		t.Error("a swapped mission is left out")
	}
	c.Post(memberPath(mom.Id)+"/missions/t2-tour/swap", nil, http.StatusConflict, nil)

	// A taken mission that is swapped loses its plan task and can be taken again.
	c.Post(memberPath(mom.Id)+"/missions/t2-babymoon/swap", nil, http.StatusNoContent, nil)
	if byTitle(taskList(c, mom.Id, ""), "Plan a babymoon day, near home").Id != uuid.Nil {
		t.Error("the swapped mission's task is gone")
	}
	c.Post(memberPath(mom.Id)+"/missions/t2-babymoon/take", nil, http.StatusCreated, &m)
	if m.State != httpapi.MissionStateTaken {
		t.Error("a mission put back can be taken again")
	}
}

func TestStickersAreEarnedFromStateOnceAndNeverForHealth(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)

	book := stickerBook(c, jake.Id)
	for _, key := range []string{"first_lesson", "path_couple", "together_couple", "mission_first", "mission_meals", "mission_both"} {
		if !book[key].Earned {
			t.Errorf("seeded stickers include %s", key)
		}
	}
	if book["path_birth"].Earned || book["baby_48h"].Earned {
		t.Error("only what the state earns is earned")
	}
	if !book["baby_48h"].Earned && book["baby_48h"].Blurb == "" {
		t.Error("open slots carry what earns them")
	}
	for key, s := range book {
		if strings.Contains(key, "mood") || strings.Contains(key, "weight") || strings.Contains(key, "symptom") || s.Group == "health" {
			t.Errorf("no sticker for health data: %s", key)
		}
	}

	// One newest sticker per parent is unseen; marking it seen plays it once.
	var fresh []string
	for key, s := range book {
		if s.New {
			fresh = append(fresh, key)
		}
	}
	if len(fresh) != 1 {
		t.Fatalf("one fresh sticker, got %v", fresh)
	}
	c.Post(memberPath(jake.Id)+"/stickers/"+fresh[0]+"/seen", nil, http.StatusNoContent, nil)
	if stickerBook(c, jake.Id)[fresh[0]].New {
		t.Error("seen stickers are not new again")
	}
	c.Post(memberPath(jake.Id)+"/stickers/path_birth/seen", nil, http.StatusNotFound, nil)

	// Finishing the rest of a path earns its sticker, and both finishing earns the pair.
	for _, id := range []uuid.UUID{mom.Id, jake.Id} {
		for _, l := range []string{"visit-rhythm", "everyday-habits", "first-movements", "warning-signs"} {
			c.Put(memberPath(id)+"/lesson-reads/"+l, map[string]any{"finished": true}, http.StatusOK, nil)
		}
		b := stickerBook(c, id)
		if !b["path_your-pregnancy"].Earned || !b["path_your-pregnancy"].New {
			t.Errorf("%s: finished path earns a new sticker", id)
		}
	}
	if !stickerBook(c, mom.Id)["together_your-pregnancy"].Earned {
		t.Error("both parents finishing the same path earns the together sticker")
	}

	// A new mission done earns the category sticker for the one who did it.
	c.Post(memberPath(mom.Id)+"/missions/t2-pediatrician/take", nil, http.StatusCreated, nil)
	if stickerBook(c, mom.Id)["mission_care"].Earned {
		t.Fatal("taking is not finishing")
	}
	c.Post(memberPath(mom.Id)+"/missions/t2-pediatrician/done", nil, http.StatusOK, nil)
	if !stickerBook(c, mom.Id)["mission_care"].Earned {
		t.Error("finishing a care mission earns the care sticker")
	}
}

func TestMissionsAndStickersAreParentsOnlyAndFamilyScoped(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	if len(fam.Caregivers) == 0 {
		t.Fatal("the pregnancy demo has caregivers")
	}
	for _, cg := range fam.Caregivers {
		m := memberPath(cg.Id)
		c.Get(m+"/missions", http.StatusNotFound, nil)
		c.Post(m+"/missions/t2-tour/take", nil, http.StatusNotFound, nil)
		c.Post(m+"/missions/t2-tour/done", nil, http.StatusNotFound, nil)
		c.Post(m+"/missions/t2-tour/swap", nil, http.StatusNotFound, nil)
		c.Get(m+"/stickers", http.StatusNotFound, nil)
		c.Post(m+"/stickers/first_lesson/seen", nil, http.StatusNotFound, nil)
	}
	testutil.New(t).Get(memberPath(mom.Id)+"/missions", http.StatusUnauthorized, nil)
	c.StartDemo("pregnancy") // another family's session
	c.Get(memberPath(mom.Id)+"/missions", http.StatusNotFound, nil)
	c.Get(memberPath(mom.Id)+"/stickers", http.StatusNotFound, nil)
}

func TestMissionsForOtherStages(t *testing.T) {
	c := testutil.New(t)
	for tmpl, want := range map[string]httpapi.MissionListStage{
		"planning": httpapi.MissionListStagePlanning, "newborn": httpapi.MissionListStageNewborn, "preschool": httpapi.MissionListStageToddler,
	} {
		fam := c.StartDemo(tmpl)
		mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
		l := missionList(c, mom.Id)
		if l.Stage != want {
			t.Errorf("%s: stage %s, want %s", tmpl, l.Stage, want)
		}
		done, open := 0, 0
		for _, m := range l.Items {
			if m.State == httpapi.MissionStateDone {
				done++
			}
			if m.State == httpapi.MissionStateOpen {
				open++
			}
			if string(m.Stage) != string(want) {
				t.Errorf("%s: mission %s is for %s", tmpl, m.Key, m.Stage)
			}
		}
		if done == 0 || open == 0 {
			t.Errorf("%s: the demo has done and open missions, got %d and %d", tmpl, done, open)
		}
		if !stickerBook(c, mom.Id)["first_lesson"].Earned {
			t.Errorf("%s: first lesson sticker", tmpl)
		}
	}
}
