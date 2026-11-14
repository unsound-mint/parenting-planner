-- +goose Up

-- Days this family's demo clock is ahead of the real date ("Skip ahead a week").
-- It belongs to the family copy, so starting a new demo resets it to 0.
ALTER TABLE families ADD COLUMN demo_offset_days integer NOT NULL DEFAULT 0 CHECK (demo_offset_days >= 0);

-- +goose Down
ALTER TABLE families DROP COLUMN demo_offset_days;
