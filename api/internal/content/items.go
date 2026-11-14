package content

import (
	"fmt"
	"time"
)

// ItemKind is a kind of editable content in the admin panel.
type ItemKind string

const (
	ItemPregnancyWeek     ItemKind = "pregnancy_week"
	ItemGuide             ItemKind = "guide"
	ItemSimulatorQuestion ItemKind = "simulator_question"
	ItemChecklistItem     ItemKind = "checklist_item"
)

// Item is one editable catalog entry: a title and a body over the code
// catalog. The source is the catalog's and never changes with an edit.
type Item struct {
	Kind   ItemKind
	ID     string
	Title  string
	Body   string
	Source *Source
}

// WeekItemID is the slug of a weekly card, for example week-25.
func WeekItemID(week int) string { return fmt.Sprintf("week-%d", week) }

// Items returns the catalog entries of a kind, in catalog order: week number
// for cards, catalog order for guides. Practice questions and checklist items
// are not in this package yet, so they return none.
func Items(kind ItemKind) []Item {
	out := []Item{}
	switch kind {
	case ItemPregnancyWeek:
		for week := MinWeek; week <= MaxWeek; week++ {
			w, ok := windowFor(week)
			if !ok {
				continue
			}
			src := w.source
			out = append(out, Item{Kind: kind, ID: WeekItemID(week), Title: fmt.Sprintf("Week %d", week), Body: w.whyFor(week), Source: &src})
		}
	case ItemGuide:
		for _, g := range guides {
			src := g.Source
			out = append(out, Item{Kind: kind, ID: g.ID, Title: g.Title, Body: g.Summary, Source: &src})
		}
	}
	return out
}

// FindItem returns one catalog entry; ok is false for an unknown slug.
func FindItem(kind ItemKind, id string) (Item, bool) {
	for _, it := range Items(kind) {
		if it.ID == id {
			return it, true
		}
	}
	return Item{}, false
}

// Edit is one family's change to an item; nil keeps the catalog's text.
type Edit struct {
	Title     *string
	Body      *string
	UpdatedAt time.Time
}

type ItemKey struct {
	Kind ItemKind
	ID   string
}

// Edits are a family's changes to the catalog, made in the admin panel.
// Every reader of an editable title or body goes through Apply, so an edit
// shows on every screen from the next read. A nil Edits changes nothing.
type Edits map[ItemKey]Edit

// Apply returns the title and body with the family's edit, if any.
func (e Edits) Apply(kind ItemKind, id, title, body string) (string, string) {
	ed, ok := e[ItemKey{kind, id}]
	if !ok {
		return title, body
	}
	if ed.Title != nil {
		title = *ed.Title
	}
	if ed.Body != nil {
		body = *ed.Body
	}
	return title, body
}

// Item applies the family's edit to a catalog item.
func (e Edits) Item(it Item) Item {
	it.Title, it.Body = e.Apply(it.Kind, it.ID, it.Title, it.Body)
	return it
}

// Guide applies the family's edit to a guide's title and summary.
func (e Edits) Guide(g Entry) Entry {
	g.Title, g.Summary = e.Apply(ItemGuide, g.ID, g.Title, g.Summary)
	return g
}

// Card applies the family's edits to a weekly card's text and its birth prep
// modules. The card has no title field, so only the body shows.
func (e Edits) Card(c Card) Card {
	_, c.WhyItMatters = e.Apply(ItemPregnancyWeek, WeekItemID(c.Week), "", c.WhyItMatters)
	prep := make([]Entry, 0, len(c.BirthPrep))
	for _, g := range c.BirthPrep {
		prep = append(prep, e.Guide(g))
	}
	c.BirthPrep = prep
	return c
}
