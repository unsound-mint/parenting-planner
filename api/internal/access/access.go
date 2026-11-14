// Package access is the single place that decides who may read sensitive
// family data (lab results, diaries, mood check-ins, session notes).
//
// SQL list queries must filter with the same rules; each such query names
// the function it mirrors in a comment. When you add a visibility level or a
// viewer kind, update both and the tests.
package access

import "github.com/google/uuid"

type Visibility string

const (
	Private  Visibility = "private"   // owner only
	Partner  Visibility = "partner"   // owner and the other parent
	CareTeam Visibility = "care_team" // owner and their chosen professionals, not the partner
	Family   Visibility = "family"    // both parents
)

func (v Visibility) Valid() bool {
	switch v {
	case Private, Partner, CareTeam, Family:
		return true
	}
	return false
}

// CanParentRead reports whether a parent may read a record owned by owner.
func CanParentRead(viewer, owner uuid.UUID, v Visibility) bool {
	if viewer == owner {
		return true
	}
	return v == Partner || v == Family
}

// CanParentReadHealthRecord reports whether a parent may read a health record
// (lab value, allergy) in the passport. Records about the child are open to
// both parents whatever their visibility; records about a parent follow
// CanParentRead.
func CanParentReadHealthRecord(viewer, owner uuid.UUID, v Visibility, aboutChild bool) bool {
	return aboutChild || CanParentRead(viewer, owner, v)
}
