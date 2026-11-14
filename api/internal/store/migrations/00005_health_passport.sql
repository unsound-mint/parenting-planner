-- +goose Up

-- One measured value per row for the passport. Panels without a single value
-- (value IS NULL) stay in the table for the plan but are not listed.
ALTER TABLE lab_results
    ADD COLUMN name      text,
    ADD COLUMN value     numeric,
    ADD COLUMN unit      text,
    ADD COLUMN ref_low   numeric,
    ADD COLUMN ref_high  numeric;

-- immunizations holds doses given. dose is the label shown, e.g. "Dose 2 of 5".
ALTER TABLE immunizations ADD COLUMN dose text;

-- Doses the family expects to get. A dose leaves the schedule once a row
-- with the same subject, vaccine and dose exists in immunizations.
CREATE TABLE vaccine_schedule (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id          uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    subject_member_id  uuid REFERENCES members(id) ON DELETE CASCADE,
    subject_child_id   uuid REFERENCES children(id) ON DELETE CASCADE,
    vaccine            text NOT NULL,
    dose               text NOT NULL,
    due_on             date NOT NULL,
    CHECK ((subject_member_id IS NULL) <> (subject_child_id IS NULL))
);
CREATE INDEX vaccine_schedule_family_idx ON vaccine_schedule (family_id, due_on);

CREATE TABLE allergies (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id          uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    subject_member_id  uuid REFERENCES members(id) ON DELETE CASCADE,
    subject_child_id   uuid REFERENCES children(id) ON DELETE CASCADE,
    owner_member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility         text NOT NULL CHECK (visibility IN ('private','partner','care_team','family')),
    substance          text NOT NULL,
    certainty          text NOT NULL CHECK (certainty IN ('suspected','confirmed')),
    reaction           text,
    noted_on           date,
    created_at         timestamptz NOT NULL DEFAULT now(),
    CHECK ((subject_member_id IS NULL) <> (subject_child_id IS NULL))
);
CREATE INDEX allergies_family_created_idx ON allergies (family_id, created_at DESC);

CREATE TABLE growth_measurements (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    measured_on  date NOT NULL,
    weight_kg    numeric(5,2) NOT NULL CHECK (weight_kg > 0),
    height_cm    numeric(5,1) NOT NULL CHECK (height_cm > 0)
);
CREATE INDEX growth_measurements_family_idx ON growth_measurements (family_id, measured_on);

-- Whose professional this is, and where they work. Both optional: rows
-- without a subject fall back to a default person by role.
ALTER TABLE care_team
    ADD COLUMN clinic             text,
    ADD COLUMN subject_member_id  uuid REFERENCES members(id) ON DELETE CASCADE,
    ADD COLUMN subject_child_id   uuid REFERENCES children(id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE care_team DROP COLUMN subject_child_id, DROP COLUMN subject_member_id, DROP COLUMN clinic;
DROP TABLE growth_measurements, allergies, vaccine_schedule;
ALTER TABLE immunizations DROP COLUMN dose;
ALTER TABLE lab_results DROP COLUMN ref_high, DROP COLUMN ref_low, DROP COLUMN unit, DROP COLUMN value, DROP COLUMN name;
