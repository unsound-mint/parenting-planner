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
