-- +goose Up

-- A breastfeed can use both sides; endedAt already gives its length and
-- amount_ml a bottle's amount.
ALTER TABLE care_log_entries DROP CONSTRAINT care_log_entries_feed_method_check;
ALTER TABLE care_log_entries ADD CONSTRAINT care_log_entries_feed_method_check
    CHECK (feed_method IN ('breast_left','breast_right','breast_both','bottle_breast_milk','bottle_formula'));

-- Head circumference is measured at the same visits, but not always.
ALTER TABLE growth_measurements ADD COLUMN head_cm numeric(4,1) CHECK (head_cm > 0);

-- +goose Down
ALTER TABLE growth_measurements DROP COLUMN head_cm;
UPDATE care_log_entries SET feed_method = 'breast_left' WHERE feed_method = 'breast_both';
ALTER TABLE care_log_entries DROP CONSTRAINT care_log_entries_feed_method_check;
ALTER TABLE care_log_entries ADD CONSTRAINT care_log_entries_feed_method_check
    CHECK (feed_method IN ('breast_left','breast_right','bottle_breast_milk','bottle_formula'));
