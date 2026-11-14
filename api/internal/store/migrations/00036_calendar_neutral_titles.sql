-- +goose Up
ALTER TABLE calendar_events ADD COLUMN neutral_title boolean NOT NULL DEFAULT false;
-- +goose Down
ALTER TABLE calendar_events DROP COLUMN neutral_title;
