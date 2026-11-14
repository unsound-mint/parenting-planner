-- +goose Up

-- How the author felt when writing (1 to 5, the mood_checkins scale), and
-- whether they marked the entry as a first (first kick, first smile). Both are
-- part of the entry, so they follow its visibility. Older entries have no mood
-- and are not firsts.
ALTER TABLE diary_entries ADD COLUMN mood smallint CHECK (mood BETWEEN 1 AND 5);
ALTER TABLE diary_entries ADD COLUMN is_first boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE diary_entries DROP COLUMN is_first;
ALTER TABLE diary_entries DROP COLUMN mood;
