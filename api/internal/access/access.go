// Package access is the single place that decides who may read sensitive
// family data (lab results, diaries, mood check-ins, session notes).
//
// SQL list queries must filter with the same rules; each such query names
// the function it mirrors in a comment. When you add a visibility level or a
// viewer kind, update both and the tests.
package access

import (
	"slices"

	"github.com/google/uuid"
)

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

// CanCaregiverReadChildRecord reports whether a grandparent or nanny may read a
// record about the child (an allergy) in the baby passport: only with the
// baby_passport permission, and then whatever visibility its owner set, because
// it is safety information about the child. Records about a parent never reach
// a caregiver.
func CanCaregiverReadChildRecord(permissions []string, aboutChild bool) bool {
	return aboutChild && slices.Contains(permissions, "baby_passport")
}

// CanSessionActAs reports whether a pp_session may act as member in a
// /members/{memberId} path. A demo session is not bound to anyone (bound is
// not Valid) and acts as either parent of its family. A session opened by
// accepting an invitation is bound to that caregiver and acts only as them,
// so a nanny can never read a parent's diary or mood by putting the parent's
// id in the path. The family and role checks (GetMember, GetPerson) still
// apply on top of this.
func CanSessionActAs(bound uuid.NullUUID, member uuid.UUID) bool {
	return !bound.Valid || bound.UUID == member
}

// SessionIsLive reports whether a session still works. A session bound to a
// member ends once that member's access is revoked; a demo session lives
// until it expires. GetSessionFamily applies the same rule in SQL.
func SessionIsLive(bound, memberRevoked bool) bool {
	return !bound || !memberRevoked
}

// CanManageFamily reports whether a session may act on the family as a whole:
// delete it, skip demo time, request an upgrade, edit content or offers, and
// open the analytics dashboard. boundRole is the role of the member the
// session is bound to, "" for a demo session, which acts as a parent. A
// caregiver's session may not.
func CanManageFamily(boundRole string) bool {
	return boundRole == "" || boundRole == "mother" || boundRole == "partner"
}
