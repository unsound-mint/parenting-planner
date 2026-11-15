package missions

import "testing"

// This week suggests the first open mission; it must change every week in
// every stage, while taken and done missions keep their place.
func TestFirstOpenMissionChangesEveryWeek(t *testing.T) {
	for _, stage := range []Stage{Planning, Tri1, Tri2, Tri3, Newborn, Baby, Toddler} {
		var views []View
		for _, m := range For(stage) {
			views = append(views, View{Mission: m, State: StateOpen})
		}
		if len(views) < 2 {
			t.Fatalf("%s: %d missions, nothing to rotate", stage, len(views))
		}
		views[0].State = StateTaken
		prev := ""
		for w := range 30 {
			got := RotateOpen(views, w)
			if got[0].Key != views[0].Key {
				t.Fatalf("%s week %d: the taken mission moved", stage, w)
			}
			first := ""
			for _, v := range got {
				if v.State == StateOpen {
					first = v.Key
					break
				}
			}
			if len(views) > 2 && first == prev {
				t.Errorf("%s week %d: same first open mission %s", stage, w, first)
			}
			prev = first
		}
	}
}
