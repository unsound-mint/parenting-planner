package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/passport"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

var errNoChildInFamily = Error{Code: "not_found", Message: "no such child in this family"}

// GetChildPassport is the baby passport card. A parent sees everything; a
// grandparent or nanny with baby_passport sees the profile, pediatrician,
// allergies and emergency contacts, with limitedView true and no history or
// vaccines. Allergies come back whatever visibility their owner set: they are
// safety information about the child.
func (s *Server) GetChildPassport(ctx context.Context, req GetChildPassportRequestObject) (GetChildPassportResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetChildPassport401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetChildPassport404JSONResponse(errNoMember), nil
	}
	parent := isParentRole(m.Role)
	if !parent && !access.CanCaregiverReadChildRecord(m.Permissions, true) {
		return GetChildPassport403JSONResponse(errForbidden), nil
	}
	today := s.today(ctx)
	card, err := passport.Child(ctx, s.pool, familyID, m.ID, req.ChildId, parent, today)
	if errors.Is(err, passport.ErrNoChild) {
		return GetChildPassport404JSONResponse(errNoChildInFamily), nil
	}
	if err != nil {
		return nil, err
	}

	pp := passportPersonOut(card.Child, today)
	out := ChildPassport{
		Child: Child{
			Id: card.Child.ChildID, Name: card.Child.Name, BirthDate: openapi_types.Date{Time: *card.Child.BirthDate},
			AgeMonths: monthsBetween(*card.Child.BirthDate, today),
		},
		LimitedView: !parent, Allergies: pp.Allergies, EmergencyContacts: make([]EmergencyContact, 0, len(card.Contacts)),
	}
	for _, c := range pp.CareTeam {
		if c.Role == CareRolePediatrician {
			c := c
			out.Pediatrician = &c
			break
		}
	}
	for _, c := range card.Contacts {
		out.EmergencyContacts = append(out.EmergencyContacts, EmergencyContact{Name: c.Name, Relation: c.Relation, Phone: c.Phone})
	}
	if parent {
		hist := make([]MedicalHistoryEntry, 0, len(card.History))
		for _, l := range card.History { // newest first
			hist = append(hist, historyOut(l))
		}
		out.MedicalHistory, out.Vaccines = &hist, &pp.Vaccines
	}
	return GetChildPassport200JSONResponse(out), nil
}

// historyOut turns a lab or screening record into a line of the medical history.
func historyOut(l store.LabResult) MedicalHistoryEntry {
	title := strings.ToUpper(l.Kind[:1]) + strings.ReplaceAll(l.Kind[1:], "_", " ")
	if l.Name != nil {
		title = *l.Name
	}
	e := MedicalHistoryEntry{Date: openapi_types.Date{Time: l.TakenOn}, Title: title}
	switch {
	case l.Note != nil && *l.Note != "":
		e.Detail = l.Note
	case len(l.Result) > 0:
		if d := resultDetail(l.Result); d != "" {
			e.Detail = &d
		}
	}
	return e
}

// resultDetail renders a flat JSON result as "key: value, key: value".
func resultDetail(raw []byte) string {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil || len(m) == 0 {
		return ""
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s: %v", strings.ReplaceAll(k, "_", " "), m[k]))
	}
	return strings.Join(parts, ", ")
}
