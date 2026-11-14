package content

import (
	_ "embed"
	"encoding/json"
	"slices"
	"strings"
	"sync"
)

// The baby name catalog behind the names quest: heritage and culture lists,
// a short meaning per name and US popularity from the Social Security
// Administration. Built by namesbuild/build_names.py; see its docstring for
// the sources and how to rebuild.

//go:embed baby_names.json
var babyNamesJSON []byte

type NameStat struct {
	Rank  int `json:"rank"`
	Count int `json:"count"`
}

type CatalogName struct {
	Name  string   `json:"name"`
	Sex   string   `json:"sex"` // F, M, or N when at least a quarter of the babies were the other sex
	Lists []string `json:"lists"`
	// SSA has "F" and "M" entries for the latest year.
	SSA     map[string]NameStat `json:"ssa"`
	Trend   []int               `json:"trend"` // babies in each of NameCatalog.TrendYears
	Origin  string              `json:"origin"`
	Meaning string              `json:"meaning"`
	Source  string              `json:"source"` // the entry the meaning paraphrases
}

// Babies is the number of US babies, both sexes, given the name in the latest year.
func (n CatalogName) Babies() int { return n.SSA["F"].Count + n.SSA["M"].Count }

// Rank is the name's rank for its sex; for a neutral name, the better of the two.
func (n CatalogName) Rank() int {
	switch n.Sex {
	case "F":
		return n.SSA["F"].Rank
	case "M":
		return n.SSA["M"].Rank
	}
	f, m := n.SSA["F"].Rank, n.SSA["M"].Rank
	if f == 0 || (m != 0 && m < f) {
		return m
	}
	return f
}

type NameList struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type NameCatalog struct {
	Year       int               `json:"year"`
	TrendYears []int             `json:"trendYears"`
	CheckedAt  string            `json:"checkedAt"`
	Sources    map[string]string `json:"sources"`
	Lists      []NameList        `json:"lists"`
	Names      []CatalogName     `json:"names"`

	byName map[string]int
}

var names = sync.OnceValue(func() *NameCatalog {
	var c NameCatalog
	if err := json.Unmarshal(babyNamesJSON, &c); err != nil {
		panic("content: baby_names.json: " + err.Error())
	}
	c.byName = make(map[string]int, len(c.Names))
	for i, n := range c.Names {
		c.byName[strings.ToLower(n.Name)] = i
	}
	return &c
})

// Names is the catalog, parsed once.
func Names() *NameCatalog { return names() }

// Name finds a catalog name, ignoring case.
func (c *NameCatalog) Name(name string) (CatalogName, bool) {
	i, ok := c.byName[strings.ToLower(strings.TrimSpace(name))]
	if !ok {
		return CatalogName{}, false
	}
	return c.Names[i], true
}

// HasList reports whether id is a list of the catalog.
func (c *NameCatalog) HasList(id string) bool {
	return slices.ContainsFunc(c.Lists, func(l NameList) bool { return l.ID == id })
}

// ListSize counts the names on a list.
func (c *NameCatalog) ListSize(id string) int {
	n := 0
	for _, name := range c.Names {
		if slices.Contains(name.Lists, id) {
			n++
		}
	}
	return n
}
