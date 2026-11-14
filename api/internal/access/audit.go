package access

import (
	"context"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Audit actions. Use these constants, not free text.
const (
	ActionCreate = "create"
	ActionRead   = "read"
	ActionUpdate = "update"
	ActionDelete = "delete"
	// Invitation events, shown in the access log.
	ActionAccept = "accept"
	ActionRevoke = "revoke"
)

// Audit records that a parent read or changed sensitive data. Call it from the
// domain package for every create, update, delete and list of a sensitive
// entity. entityID is empty for list reads.
func Audit(ctx context.Context, q *store.Queries, familyID, actor uuid.UUID, action, entity, entityID string) error {
	var id *string
	if entityID != "" {
		id = &entityID
	}
	return q.InsertAudit(ctx, store.InsertAuditParams{
		FamilyID:      familyID,
		ActorMemberID: uuid.NullUUID{UUID: actor, Valid: true},
		Action:        action,
		Entity:        entity,
		EntityID:      id,
	})
}
