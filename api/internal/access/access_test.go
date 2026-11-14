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

func TestCanSessionActAs(t *testing.T) {
	mom, partner, nanny := uuid.New(), uuid.New(), uuid.New()
	demo := uuid.NullUUID{}
	bound := uuid.NullUUID{UUID: nanny, Valid: true}
	cases := []struct {
		name    string
		session uuid.NullUUID
		member  uuid.UUID
		want    bool
	}{
		{"demo session as mother", demo, mom, true},
		{"demo session as partner", demo, partner, true},
		{"caregiver session as themselves", bound, nanny, true},
		{"caregiver session as mother", bound, mom, false},
		{"caregiver session as partner", bound, partner, false},
	}
	for _, c := range cases {
		if got := CanSessionActAs(c.session, c.member); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestSessionIsLive(t *testing.T) {
	if !SessionIsLive(false, false) {
		t.Error("a demo session lives until it expires")
	}
	if !SessionIsLive(true, false) {
		t.Error("a caregiver's session works while their access is active")
	}
	if SessionIsLive(true, true) {
		t.Error("a revoked caregiver's session must stop working")
	}
}
