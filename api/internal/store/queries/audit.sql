-- name: InsertAudit :exec
INSERT INTO audit_log (family_id, actor_member_id, action, entity, entity_id) VALUES ($1, $2, $3, $4, $5);
