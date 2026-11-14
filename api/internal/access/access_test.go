package access

import (
	"testing"

	"github.com/google/uuid"
)

func TestCanParentRead(t *testing.T) {
	mom, partner := uuid.New(), uuid.New()
	cases := []struct {
		v    Visibility
		want bool
	}{
		{Private, false},
		{CareTeam, false},
		{Partner, true},
		{Family, true},
	}
	for _, c := range cases {
		if !CanParentRead(mom, mom, c.v) {
			t.Errorf("owner must always read own %s record", c.v)
		}
		if got := CanParentRead(partner, mom, c.v); got != c.want {
			t.Errorf("partner reading %s record: got %v, want %v", c.v, got, c.want)
		}
	}
}

func TestCanParentReadHealthRecord(t *testing.T) {
	mom, partner := uuid.New(), uuid.New()
	for _, v := range []Visibility{Private, Partner, CareTeam, Family} {
		if !CanParentReadHealthRecord(partner, mom, v, true) {
			t.Errorf("both parents must read the child's %s record", v)
		}
		if got, want := CanParentReadHealthRecord(partner, mom, v, false), CanParentRead(partner, mom, v); got != want {
			t.Errorf("parent's %s record: got %v, want %v (CanParentRead)", v, got, want)
		}
	}
}

func TestCanCaregiverReadChildRecord(t *testing.T) {
	if !CanCaregiverReadChildRecord([]string{"care_log", "baby_passport"}, true) {
		t.Error("a caregiver with baby_passport reads the child's records")
	}
	if CanCaregiverReadChildRecord([]string{"care_log", "schedule"}, true) {
		t.Error("a caregiver without baby_passport reads no child records")
	}
	if CanCaregiverReadChildRecord([]string{"baby_passport"}, false) {
		t.Error("a caregiver never reads a parent's records")
	}
}
