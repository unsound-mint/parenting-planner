package supplies

import "testing"

func TestSuggest(t *testing.T) {
	cases := []struct {
		age            int
		kg             float64
		clothing, diap string
		basis          string
	}{
		{0, 0, "Newborn", "Newborn", "age"},
		{2, 0, "0-3 months", "Size 1", "age"},
		{2, 6.2, "3-6 months", "Size 2", "weight"}, // a big baby goes up a size
		{2, 4.0, "0-3 months", "Newborn", "age"},   // a small baby does not go down
		{10, 0, "9-12 months", "Size 3", "age"},
		{30, 14, "2T", "Size 4", "age"}, // weight is ignored from 2 years
		{70, 0, "5T and up", "Size 6", "age"},
	}
	for _, c := range cases {
		cl, d, b := Suggest(c.age, c.kg)
		if cl != c.clothing || d != c.diap || b != c.basis {
			t.Errorf("Suggest(%d, %v) = %q %q %q, want %q %q %q", c.age, c.kg, cl, d, b, c.clothing, c.diap, c.basis)
		}
	}
}
