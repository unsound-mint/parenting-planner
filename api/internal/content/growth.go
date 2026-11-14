package content

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

// growth_weeks.json is what develops in each pregnancy week, as body areas the
// 3D baby view pins as hotspots. Each hotspot paraphrases the NHS page for the
// same week and cites it by id from size_weeks.json. Each fact appears in one
// week only, and the survival and distress lines on the NHS pages are left out.
//
//go:embed growth_weeks.json
var growthWeeksJSON []byte

// GrowthAreas are the body areas a hotspot can sit on. The web view has one
// anchor per area, so adding one here means adding it to the contract enum and
// the 3D model too. body is the whole baby (growth, proportions), cord is the
// umbilical cord and placenta, movement is the baby's kicks and wriggles.
var GrowthAreas = []string{
	"brain", "face", "eyes", "ears", "mouth", "heart", "lungs", "tummy", "kidneys",
	"hands", "legs", "skin", "bones", "movement", "body", "cord",
}

// Hotspot is one thing that develops in a week, pinned to a body area.
type Hotspot struct {
	Area   string
	Text   string
	Source Source
}

// GrowthWeek is one week of the 3D baby: its size and what develops.
type GrowthWeek struct {
	Week     int
	Size     Size
	Hotspots []Hotspot
}

var growthWeeks = loadGrowthWeeks()

func loadGrowthWeeks() []GrowthWeek {
	var f struct {
		Weeks []struct {
			Week     int `json:"week"`
			Hotspots []struct {
				Area   string `json:"area"`
				Text   string `json:"text"`
				Source string `json:"source"`
			} `json:"hotspots"`
		} `json:"weeks"`
	}
	if err := json.Unmarshal(growthWeeksJSON, &f); err != nil {
		panic(fmt.Sprintf("growth_weeks.json: %v", err))
	}
	out := make([]GrowthWeek, 0, len(f.Weeks))
	for _, w := range f.Weeks {
		size, _, ok := SizeFor(w.Week)
		if !ok {
			panic(fmt.Sprintf("growth_weeks.json: week %d has no size", w.Week))
		}
		g := GrowthWeek{Week: w.Week, Size: size, Hotspots: make([]Hotspot, 0, len(w.Hotspots))}
		for _, h := range w.Hotspots {
			src, ok := sizeSources[h.Source]
			if !ok {
				panic("growth_weeks.json: unknown source " + h.Source)
			}
			g.Hotspots = append(g.Hotspots, Hotspot{Area: h.Area, Text: h.Text, Source: src})
		}
		out = append(out, g)
	}
	return out
}

// GrowthWeeks returns weeks 4 to 40 in order. The slice is shared; do not modify it.
func GrowthWeeks() []GrowthWeek { return growthWeeks }
