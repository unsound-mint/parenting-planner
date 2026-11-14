-- +goose Up

-- While a family is in pregnancy loss support, the stage is planning and the due
-- date is cleared; the stage and due date they replaced are kept here so a mistaken
-- tap can be undone. Everything else (week, card, rules) is computed from the stage.
ALTER TABLE families
    ADD COLUMN pregnancy_loss_recorded_at   timestamptz,
    ADD COLUMN pregnancy_loss_occurred_on   date,
    ADD COLUMN pregnancy_loss_prior_stage   text,
    ADD COLUMN pregnancy_loss_prior_due_date date;

-- +goose Down
ALTER TABLE families
    DROP COLUMN pregnancy_loss_prior_due_date,
    DROP COLUMN pregnancy_loss_prior_stage,
    DROP COLUMN pregnancy_loss_occurred_on,
    DROP COLUMN pregnancy_loss_recorded_at;
