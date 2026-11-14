package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

// Each demo family gets the library with its own moment first.
func TestLibraryPutsEachFamilysNowFirst(t *testing.T) {
	cases := []struct{ template, position, nowTopic string }{
		{"planning", "Getting ready for a baby", "folic-acid-before-pregnancy"},
		{"pregnancy", "Week 25 of pregnancy", "reduced-fetal-movements-and-kick-counting"},
		{"preschool", "4 years old", "bedtime-routine-fears"},
	}
	for _, tc := range cases {
		c := testutil.New(t)
		mom := testutil.Parent(t, c.StartDemo(tc.template), httpapi.ParentRoleMother)
		var l httpapi.LibraryTopicList
		c.Get(memberPath(mom.Id)+"/library-topics", http.StatusOK, &l)
		if l.Position != tc.position {
			t.Errorf("%s: position %q, want %q", tc.template, l.Position, tc.position)
		}
		if len(l.Items) < 200 || !l.Items[0].Now {
			t.Fatalf("%s: %d topics, first now=%v", tc.template, len(l.Items), len(l.Items) > 0 && l.Items[0].Now)
		}
		found := false
		for _, it := range l.Items {
			if it.Id == tc.nowTopic {
				found = it.Now
			}
		}
		if !found {
			t.Errorf("%s: %s is not marked now", tc.template, tc.nowTopic)
		}
	}
}

func TestLibraryTopicHasSourcesAndRelated(t *testing.T) {
	c := testutil.New(t)
	mom := testutil.Parent(t, c.StartDemo("pregnancy"), httpapi.ParentRoleMother)
	var tp httpapi.LibraryTopic
	c.Get(memberPath(mom.Id)+"/library-topics/freud-anal-stage", http.StatusOK, &tp)
	if tp.Evidence != httpapi.Theory {
		t.Errorf("Freud's anal stage is labelled %s, want theory", tp.Evidence)
	}
	if tp.WhatToKnow == "" || len(tp.Sources) == 0 || tp.Sources[0].CheckedAt.IsZero() {
		t.Errorf("incomplete topic %+v", tp)
	}
	c.Get(memberPath(mom.Id)+"/library-topics/no-such-topic", http.StatusNotFound, nil)
}

// The library is for parents: caregivers and another family's session get 404.
func TestLibraryIsForParentsOfThisFamilyOnly(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	for _, cg := range fam.Caregivers {
		c.Get(memberPath(cg.Id)+"/library-topics", http.StatusNotFound, nil)
		c.Get(memberPath(cg.Id)+"/library-topics/caffeine-in-pregnancy", http.StatusNotFound, nil)
	}
	c.StartDemo("pregnancy")
	c.Get(memberPath(mom.Id)+"/library-topics", http.StatusNotFound, nil)
}
