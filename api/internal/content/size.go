package content

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// size_weeks.json is the sourced baby size and development for weeks 4 to 40
// (lengths and development from each NHS week page, weights from the WHO fetal
// growth charts, weeks 14 to 40 only). Nothing in it is interpolated, so weeks
// 4 to 13 have no weight. The development text is a paraphrase of the NHS page.
//
//go:embed size_weeks.json
var sizeWeeksJSON []byte

// Size is the baby's size for one week.
type Size struct {
	Comparison string
	LengthCm   float64
	// LengthMeasure is "embryo", "crown-rump" or "crown-heel". It changes at week 20.
	LengthMeasure string
	// WeightG and WeightRangeG (10th to 90th percentile) are zero before week 14.
	WeightG      float64
	WeightRangeG [2]float64
	Sources      []Source
}

// HasWeight reports whether a sourced weight exists for this week.
func (s Size) HasWeight() bool { return s.WeightG > 0 }

type weekSize struct {
	Size        Size
	Development string
}

// sizeSources are the sources in size_weeks.json by id (nhs-week-4 to nhs-week-40
// and the WHO chart), shared with growth_weeks.json so each page is listed once.
var sizeByWeek, sizeSources = loadSizeWeeks()

func loadSizeWeeks() (map[int]weekSize, map[string]Source) {
	var f struct {
		Sources map[string]struct {
			Title     string `json:"title"`
			URL       string `json:"url"`
			CheckedAt string `json:"checkedAt"`
		} `json:"sources"`
		Weeks []struct {
			Week          int        `json:"week"`
			LengthCm      float64    `json:"lengthCm"`
			LengthMeasure string     `json:"lengthMeasure"`
			LengthSource  string     `json:"lengthSource"`
			WeightG       float64    `json:"weightG"`
			WeightRangeG  [2]float64 `json:"weightRangeG"`
			WeightSource  string     `json:"weightSource"`
			Comparison    struct {
				Name string `json:"name"`
			} `json:"comparison"`
			Development       string `json:"development"`
			DevelopmentSource string `json:"developmentSource"`
		} `json:"weeks"`
	}
	if err := json.Unmarshal(sizeWeeksJSON, &f); err != nil {
		panic(fmt.Sprintf("size_weeks.json: %v", err))
	}
	byID := make(map[string]Source, len(f.Sources))
	for id, s := range f.Sources {
		at, err := time.Parse("2006-01-02", s.CheckedAt)
		if err != nil {
			panic("size_weeks.json: bad date for " + id)
		}
		byID[id] = Source{Title: s.Title, URL: s.URL, CheckedAt: at}
	}
	source := func(id string) Source {
		s, ok := byID[id]
		if !ok {
			panic("size_weeks.json: unknown source " + id)
		}
		return s
	}
	out := make(map[int]weekSize, len(f.Weeks))
	for _, w := range f.Weeks {
		sources := []Source{source(w.LengthSource)}
		if w.DevelopmentSource != w.LengthSource {
			sources = append(sources, source(w.DevelopmentSource))
		}
		if w.WeightSource != "" {
			sources = append(sources, source(w.WeightSource))
		}
		out[w.Week] = weekSize{
			Size: Size{
				Comparison: withArticle(w.Comparison.Name), LengthCm: w.LengthCm, LengthMeasure: w.LengthMeasure,
				WeightG: w.WeightG, WeightRangeG: w.WeightRangeG, Sources: sources,
			},
			Development: w.Development,
		}
	}
	return out, byID
}

func withArticle(name string) string {
	if strings.ContainsAny(name[:1], "aeiou") {
		return "an " + name
	}
	return "a " + name
}

// SizeFor returns the size and development text for week; ok is false outside weeks 4 to 40.
func SizeFor(week int) (Size, string, bool) {
	w, ok := sizeByWeek[week]
	return w.Size, w.Development, ok
}
