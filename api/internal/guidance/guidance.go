// Package guidance collects every source the app's content is checked against
// into one deduplicated list for the public "How we check health guidance"
// page. Cards do not show their sources; this list is where they live.
//
// It walks the catalogs by reflection and picks up any struct with string
// fields Title and URL and a time.Time CheckedAt (rules.Source, content.Source,
// money.Source and the like), so a new catalog only needs adding to roots.
package guidance

import (
	"net/url"
	"reflect"
	"slices"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/unsound-mint/parenting-planner/api/internal/content"
	"github.com/unsound-mint/parenting-planner/api/internal/fertility"
	"github.com/unsound-mint/parenting-planner/api/internal/missions"
	"github.com/unsound-mint/parenting-planner/api/internal/money"
	"github.com/unsound-mint/parenting-planner/api/internal/rules"
	"github.com/unsound-mint/parenting-planner/api/internal/virtualbaby"
)

type Topic string

const (
	Pregnancy    Topic = "pregnancy"
	Newborn      Topic = "newborn"
	Child        Topic = "child"
	Nutrition    Topic = "nutrition"
	MentalHealth Topic = "mental_health"
	Family       Topic = "family"
)

var topicOrder = map[Topic]int{Pregnancy: 0, Newborn: 1, Child: 2, Nutrition: 3, MentalHealth: 4, Family: 5}

type Entry struct {
	Topic        Topic
	Organization string
	Title        string
	URL          string
	CheckedAt    time.Time
}

func roots() []any {
	r := []any{rules.All(), rules.Instruments(), missions.Catalog, fertility.Items, fertility.OverviewSources, money.Starter, virtualbaby.Scenarios()}
	return append(r, content.SourceRoots()...)
}

// Sources is computed once: the catalogs are compiled-in data.
var Sources = sync.OnceValue(func() []Entry { return collect(roots()) })

func collect(rs []any) []Entry {
	byURL := map[string]Entry{}
	add := func(title, u string, at time.Time) {
		if u == "" {
			return
		}
		key := strings.TrimSuffix(u, "/")
		if old, ok := byURL[key]; ok {
			// One row per page: keep the latest check.
			if at.After(old.CheckedAt) {
				old.CheckedAt = at
				byURL[key] = old
			}
			return
		}
		byURL[key] = Entry{Topic: topicOf(title, u), Organization: organization(title, u), Title: title, URL: u, CheckedAt: at}
	}
	seen := map[uintptr]bool{}
	var walk func(v reflect.Value, depth int)
	walk = func(v reflect.Value, depth int) {
		if depth > 12 || !v.IsValid() {
			return
		}
		switch v.Kind() {
		case reflect.Pointer, reflect.Interface:
			if v.IsNil() {
				return
			}
			if v.Kind() == reflect.Pointer {
				if seen[v.Pointer()] {
					return
				}
				seen[v.Pointer()] = true
			}
			walk(v.Elem(), depth+1)
		case reflect.Slice, reflect.Array:
			for i := range v.Len() {
				walk(v.Index(i), depth+1)
			}
		case reflect.Map:
			it := v.MapRange()
			for it.Next() {
				walk(it.Value(), depth+1)
			}
		case reflect.Struct:
			if title, u, at, ok := asSource(v); ok {
				add(title, u, at)
				return
			}
			for i := range v.NumField() {
				walk(v.Field(i), depth+1)
			}
		}
	}
	for _, r := range rs {
		// Copy into an addressable value so fields reached through unexported
		// struct fields can still be read (see readTime).
		c := reflect.New(reflect.TypeOf(r)).Elem()
		c.Set(reflect.ValueOf(r))
		walk(c, 0)
	}
	out := make([]Entry, 0, len(byURL))
	for _, e := range byURL {
		out = append(out, e)
	}
	slices.SortFunc(out, func(a, b Entry) int {
		if d := topicOrder[a.Topic] - topicOrder[b.Topic]; d != 0 {
			return d
		}
		if c := strings.Compare(a.Organization, b.Organization); c != 0 {
			return c
		}
		return strings.Compare(a.Title, b.Title)
	})
	return out
}

var timeType = reflect.TypeFor[time.Time]()

func asSource(v reflect.Value) (title, u string, at time.Time, ok bool) {
	t, uv, c := v.FieldByName("Title"), v.FieldByName("URL"), v.FieldByName("CheckedAt")
	if !t.IsValid() || !uv.IsValid() || !c.IsValid() || t.Kind() != reflect.String || uv.Kind() != reflect.String || c.Type() != timeType {
		return "", "", time.Time{}, false
	}
	at, ok = readTime(c)
	return t.String(), uv.String(), at, ok
}

// readTime reads a time.Time even when it was reached through an unexported
// field, which reflect marks read-only. Read only, never written.
func readTime(v reflect.Value) (time.Time, bool) {
	if v.CanInterface() {
		return v.Interface().(time.Time), true
	}
	if v.CanAddr() {
		return *(*time.Time)(unsafe.Pointer(v.UnsafeAddr())), true
	}
	return time.Time{}, false
}

// organization names the publisher from the page's host; unknown hosts fall
// back to the title's first phrase ("NHS Start for Life: Week 25" reads "NHS Start for Life").
func organization(title, raw string) string {
	host := ""
	if p, err := url.Parse(raw); err == nil {
		host = strings.TrimPrefix(strings.ToLower(p.Hostname()), "www.")
	}
	for _, o := range orgs {
		if host == o.host || strings.HasSuffix(host, "."+o.host) {
			return o.name
		}
	}
	if parts := strings.FieldsFunc(title, func(r rune) bool { return r == ':' || r == ',' || r == '(' || r == '|' }); len(parts) > 0 {
		// A long first phrase is a title, not a publisher name: use the host instead.
		if short := strings.TrimSpace(parts[0]); short != "" && (len(short) <= 28 || host == "") {
			return short
		}
	}
	return host
}

var orgs = []struct{ host, name string }{
	{"nhs.uk", "NHS"}, {"nice.org.uk", "NICE"}, {"who.int", "World Health Organization"},
	{"cdc.gov", "CDC"}, {"nih.gov", "NIH"}, {"healthychildren.org", "American Academy of Pediatrics"},
	{"aap.org", "American Academy of Pediatrics"}, {"acog.org", "ACOG"}, {"rcog.org.uk", "RCOG"},
	{"unicef.org.uk", "UNICEF UK"}, {"unicef.org", "UNICEF"}, {"lullabytrust.org.uk", "The Lullaby Trust"},
	{"gov.uk", "GOV.UK"}, {"dol.gov", "US Department of Labor"}, {"healthcare.gov", "HealthCare.gov"},
	{"medlineplus.gov", "MedlinePlus"}, {"fda.gov", "FDA"}, {"usda.gov", "USDA"}, {"ssa.gov", "Social Security Administration"},
	{"marchofdimes.org", "March of Dimes"}, {"postpartum.net", "Postpartum Support International"},
	{"tommys.org", "Tommy's"}, {"zerotothree.org", "ZERO TO THREE"}, {"mayoclinic.org", "Mayo Clinic"},
	{"rcpch.ac.uk", "RCPCH"}, {"rcpsych.ac.uk", "Royal College of Psychiatrists"}, {"mind.org.uk", "Mind"},
	{"irs.gov", "IRS"}, {"hhs.gov", "US Department of Health and Human Services"},
}

// topicOf sorts a page into one topic by its title and address. The first
// match wins, so the more specific topics come first.
func topicOf(title, u string) Topic {
	s := strings.ToLower(title + " " + u)
	for _, t := range topicWords {
		for _, w := range t.words {
			if strings.Contains(s, w) {
				return t.topic
			}
		}
	}
	return Family
}

var topicWords = []struct {
	topic Topic
	words []string
}{
	{MentalHealth, []string{"mental", "depress", "anxiety", "mood", "wellbeing", "well-being", "epds", "phq", "stress", "suicid", "baby blues", "psycholog", "grief", "loss"}},
	{Nutrition, []string{"nutrition", "food", "diet", "eating", "feeding", "breastfeed", "breast-feed", "formula", "weaning", "solid", "vitamin", "folic", "iron", "caffeine", "fish", "allerg"}},
	{Pregnancy, []string{"pregnan", "antenatal", "prenatal", "labour", "labor", "birth", "contraction", "trimester", "fetal", "foetal", "midwi", "conception", "fertil", "ovulat", "preconception", "week-by-week", "obstetric", "miscarriage"}},
	{Newborn, []string{"newborn", "postnatal", "postpartum", "infant", "baby", "babies", "sids", "safe sleep", "crying", "nappy", "diaper", "colic", "jaundice"}},
	{Child, []string{"child", "toddler", "milestone", "act-early", "vaccin", "immuni", "development", "kids", "preschool", "school", "teen"}},
}
