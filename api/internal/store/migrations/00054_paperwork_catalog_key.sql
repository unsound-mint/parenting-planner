-- +goose Up

-- A paperwork task is one entry of the embedded US family hub catalog
-- (internal/content/family_hub.json). catalog_key names the entry, so the hub
-- adds its why and how text without a second table, and the Plan tab and the
-- hub tick the same row.
ALTER TABLE tasks ADD COLUMN catalog_key text CHECK (catalog_key IS NULL OR length(catalog_key) BETWEEN 1 AND 60);
CREATE UNIQUE INDEX tasks_family_catalog_key_idx ON tasks (family_id, catalog_key) WHERE catalog_key IS NOT NULL;

-- Paperwork seeded before this migration: match it to the catalog by title.
UPDATE tasks SET catalog_key = 'leave-notice' WHERE kind = 'paperwork' AND title = 'Tell your employer you will take parental leave';
UPDATE tasks SET catalog_key = 'insurance-marketplace' WHERE kind = 'paperwork' AND title = 'Add the baby to your health insurance';
UPDATE tasks SET catalog_key = 'bonding-leave' WHERE kind = 'paperwork' AND title = 'Use your bonding leave within the first year';

-- +goose Down
DROP INDEX tasks_family_catalog_key_idx;
ALTER TABLE tasks DROP COLUMN catalog_key;
