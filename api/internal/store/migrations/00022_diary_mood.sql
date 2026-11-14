-- +goose Up

-- How the author felt when writing (1 to 5, the mood_checkins scale). Part of
-- the entry, so it follows the entry's visibility. Optional: older entries and
-- entries written without a face have none.
ALTER TABLE diary_entries ADD COLUMN mood smallint CHECK (mood BETWEEN 1 AND 5);

-- +goose Down
ALTER TABLE diary_entries DROP COLUMN mood;
