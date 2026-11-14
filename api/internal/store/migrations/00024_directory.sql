-- +goose Up
-- The provider directory is global synthetic demo data, not family data: every
-- session sees the same rows. next_available is not stored; queries compute it
-- as today + available_in_days so the seed never goes stale.
CREATE TABLE providers (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text NOT NULL,
    type              text NOT NULL CHECK (type IN ('perinatal_therapist','psychologist','doula','lactation_consultant','sleep_consultant','child_therapist','tutor')),
    city              text NOT NULL,
    state             char(2) NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
    languages         text[] NOT NULL,
    available_in_days smallint NOT NULL CHECK (available_in_days BETWEEN 0 AND 90),
    price_usd         integer NOT NULL CHECK (price_usd >= 0),
    summary           text NOT NULL
);
CREATE INDEX providers_type_state_idx ON providers (type, state);

-- A booking request can reveal that a parent is seeking care, so it is
-- sensitive: only the parent who made it reads it. Always stored private.
CREATE TABLE booking_requests (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','partner','care_team','family')),
    provider_id      uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    status           text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested')),
    note             text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (family_id, owner_member_id, provider_id)
);
CREATE INDEX booking_requests_family_created_idx ON booking_requests (family_id, created_at DESC);

-- Synthetic providers: invented names, every type, several states (TX is where
-- the demo families live). Each summary says it is a demo listing.
INSERT INTO providers (name, type, city, state, languages, available_in_days, price_usd, summary) VALUES
('Maple Grove Perinatal Counseling (demo)', 'perinatal_therapist', 'Austin', 'TX', ARRAY['English','Spanish'], 2, 140, 'Demo listing: a fictional therapist for low mood and anxiety during pregnancy and after birth.'),
('Bluebonnet Postpartum Therapy (demo)', 'perinatal_therapist', 'Houston', 'TX', ARRAY['English'], 5, 120, 'Demo listing: a fictional therapist for new parents adjusting to life with a baby.'),
('Harbor Light Perinatal Care (demo)', 'perinatal_therapist', 'San Diego', 'CA', ARRAY['English','Vietnamese'], 3, 160, 'Demo listing: a fictional therapist for birth worries and postpartum mood changes.'),
('Hudson Parents Counseling (demo)', 'perinatal_therapist', 'Brooklyn', 'NY', ARRAY['English','Russian'], 8, 180, 'Demo listing: a fictional therapist for both parents in the first year after birth.'),
('Dr. Lena Oakfield, PhD (demo)', 'psychologist', 'Austin', 'TX', ARRAY['English'], 4, 170, 'Demo listing: a fictional psychologist for stress, sleep loss and relationship strain after a baby.'),
('Dr. Marcus Reedly, PsyD (demo)', 'psychologist', 'Seattle', 'WA', ARRAY['English','Korean'], 6, 190, 'Demo listing: a fictional psychologist for fathers and partners during the perinatal period.'),
('Dr. Ana Sol Brightwater, PhD (demo)', 'psychologist', 'Miami', 'FL', ARRAY['English','Spanish'], 10, 150, 'Demo listing: a fictional psychologist for anxiety and low mood in parents.'),
('Willow Birth Doulas (demo)', 'doula', 'Austin', 'TX', ARRAY['English','Spanish'], 1, 90, 'Demo listing: a fictional doula for birth planning and support in labor.'),
('Sunrise Doula Collective (demo)', 'doula', 'Chicago', 'IL', ARRAY['English','Polish'], 7, 85, 'Demo listing: a fictional doula team for birth and the first weeks at home.'),
('Golden Hour Lactation (demo)', 'lactation_consultant', 'Dallas', 'TX', ARRAY['English'], 2, 110, 'Demo listing: a fictional lactation consultant for latch, supply and pumping questions.'),
('Pacific Milk Support (demo)', 'lactation_consultant', 'Los Angeles', 'CA', ARRAY['English','Spanish'], 4, 120, 'Demo listing: a fictional lactation consultant offering home and video visits.'),
('Quiet Nights Sleep Coaching (demo)', 'sleep_consultant', 'Austin', 'TX', ARRAY['English'], 9, 130, 'Demo listing: a fictional sleep consultant for safe infant sleep routines.'),
('Lullaby Lane Sleep Help (demo)', 'sleep_consultant', 'Denver', 'CO', ARRAY['English'], 5, 115, 'Demo listing: a fictional sleep consultant for toddlers and parents running on little sleep.'),
('Little Steps Child Therapy (demo)', 'child_therapist', 'San Antonio', 'TX', ARRAY['English','Spanish'], 12, 150, 'Demo listing: a fictional child therapist for big feelings, tantrums and school worries.'),
('Riverstone Kids Counseling (demo)', 'child_therapist', 'Albany', 'NY', ARRAY['English'], 14, 160, 'Demo listing: a fictional child therapist for ages 3 to 9.'),
('Bright Owl Tutoring (demo)', 'tutor', 'Austin', 'TX', ARRAY['English','Spanish'], 3, 60, 'Demo listing: a fictional tutor for early reading and math.'),
('Evergreen Learning Lab (demo)', 'tutor', 'Portland', 'OR', ARRAY['English','Mandarin'], 6, 70, 'Demo listing: a fictional tutor for reading support in the early grades.');

-- +goose Down
DROP TABLE booking_requests;
DROP TABLE providers;
