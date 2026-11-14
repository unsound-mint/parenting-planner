-- +goose Up
-- The CareRole contract has dentist; the role check from 00001 did not.
ALTER TABLE care_team DROP CONSTRAINT care_team_role_check;
ALTER TABLE care_team ADD CONSTRAINT care_team_role_check
    CHECK (role IN ('obgyn','midwife','birth_clinic','pediatrician','primary_care','psychologist','doula','lactation','dentist'));

-- +goose Down
DELETE FROM care_team WHERE role = 'dentist';
ALTER TABLE care_team DROP CONSTRAINT care_team_role_check;
ALTER TABLE care_team ADD CONSTRAINT care_team_role_check
    CHECK (role IN ('obgyn','midwife','birth_clinic','pediatrician','primary_care','psychologist','doula','lactation'));
