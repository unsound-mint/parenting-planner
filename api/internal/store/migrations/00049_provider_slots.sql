-- +goose Up
-- The directory becomes bookable: each provider gets a short profile, every
-- family gets its own open times with them (provider_slots), and a parent books
-- one time (provider_bookings), which they can move or cancel. booking_requests
-- from 00024 is no longer written; it stays so old rows are kept.

-- Pediatricians and obstetricians join the directory.
ALTER TABLE providers DROP CONSTRAINT providers_type_check;
ALTER TABLE providers ADD CONSTRAINT providers_type_check CHECK (type IN (
    'perinatal_therapist','psychologist','doula','lactation_consultant','sleep_consultant',
    'child_therapist','tutor','pediatrician','obstetrician'));

-- Profile fields. openings_pct is how many of a provider's possible hours are
-- open (some are busy, some are not); session_minutes is one visit's length.
-- available_in_days from 00024 is no longer read: openings come from slots.
ALTER TABLE providers
    ADD COLUMN credentials     text NOT NULL DEFAULT '',
    ADD COLUMN bio             text NOT NULL DEFAULT '',
    ADD COLUMN visit_modes     text[] NOT NULL DEFAULT ARRAY['in_person']::text[]
        CHECK (visit_modes <@ ARRAY['in_person','video','home']::text[] AND cardinality(visit_modes) > 0),
    ADD COLUMN openings_pct    smallint NOT NULL DEFAULT 25 CHECK (openings_pct BETWEEN 1 AND 100),
    ADD COLUMN session_minutes smallint NOT NULL DEFAULT 50 CHECK (session_minutes BETWEEN 15 AND 180);

-- The page says once that every provider is made up, so names and summaries
-- no longer repeat it on every row.
UPDATE providers SET
    name = regexp_replace(name, ' \(demo\)$', ''),
    summary = regexp_replace(summary, '^Demo listing: a fictional ', 'A ');

UPDATE providers AS p SET credentials = v.credentials, bio = v.bio, visit_modes = v.modes, openings_pct = v.pct, session_minutes = v.minutes
FROM (VALUES
('Maple Grove Perinatal Counseling', 'LPC, perinatal mental health certificate', 'A small practice of two counselors who see parents from early pregnancy to the first birthday. First visits are about what is going on and what you want from the sessions.', ARRAY['in_person','video'], 30, 50),
('Bluebonnet Postpartum Therapy', 'LCSW', 'Works with new parents on the weeks after the birth: sleep loss, changed roles and feeling not like yourself. Evening video sessions for parents who cannot leave the baby.', ARRAY['video'], 22, 50),
('Harbor Light Perinatal Care', 'LMFT, perinatal mental health certificate', 'Sees parents who feel anxious about the birth or low after it. Sessions in English or Vietnamese.', ARRAY['in_person','video'], 18, 50),
('Hudson Parents Counseling', 'LCSW', 'Couples and individual sessions in the first year after a baby, often both parents together.', ARRAY['in_person','video'], 12, 50),
('Dr. Lena Oakfield, PhD', 'Licensed psychologist', 'Helps parents with stress, sleep loss and strain between partners after a baby arrives. Practical, short courses of sessions.', ARRAY['in_person','video'], 20, 50),
('Dr. Marcus Reedly, PsyD', 'Licensed psychologist', 'Works mostly with fathers and partners during pregnancy and the first year. Video only.', ARRAY['video'], 15, 50),
('Dr. Ana Sol Brightwater, PhD', 'Licensed psychologist', 'Sees parents with worry and low mood, in English or Spanish.', ARRAY['video'], 10, 50),
('Willow Birth Doulas', 'Certified birth and postpartum doulas', 'A team of three doulas. The first visit is a meeting to talk through your birth preferences and how labor support works with your hospital.', ARRAY['in_person','home'], 35, 60),
('Sunrise Doula Collective', 'Certified birth doulas', 'Birth support and a few home visits in the first weeks, in English or Polish.', ARRAY['in_person','home'], 15, 60),
('Golden Hour Lactation', 'IBCLC', 'Home and clinic visits for latch, supply and pumping questions, including a weighed feed when you want one.', ARRAY['in_person','home','video'], 30, 60),
('Pacific Milk Support', 'IBCLC', 'Lactation visits at home or by video, in English or Spanish.', ARRAY['home','video'], 20, 60),
('Quiet Nights Sleep Coaching', 'Certified infant sleep consultant', 'Builds a sleep routine with you that follows safe sleep guidance, with check-ins by message for two weeks.', ARRAY['video','home'], 12, 45),
('Lullaby Lane Sleep Help', 'Certified pediatric sleep consultant', 'Sleep plans for toddlers and for parents who are running on very little sleep.', ARRAY['video'], 20, 45),
('Little Steps Child Therapy', 'LPC, registered play therapist', 'Play-based sessions for big feelings, tantrums and worries about school, ages 3 to 9.', ARRAY['in_person'], 10, 50),
('Riverstone Kids Counseling', 'LCSW', 'Counseling for children aged 3 to 9 and short parent sessions alongside.', ARRAY['in_person','video'], 8, 50),
('Bright Owl Tutoring', 'Certified elementary teacher', 'Early reading and math through games, ages 4 to 8.', ARRAY['in_person','video'], 30, 45),
('Evergreen Learning Lab', 'Reading specialist', 'Reading support in the early grades, in English or Mandarin.', ARRAY['video'], 25, 45)
) AS v(name, credentials, bio, modes, pct, minutes)
WHERE p.name = v.name;

INSERT INTO providers (name, type, city, state, languages, available_in_days, price_usd, summary, credentials, bio, visit_modes, openings_pct, session_minutes) VALUES
('Cedar Park Pediatrics', 'pediatrician', 'Austin', 'TX', ARRAY['English','Spanish'], 0, 160, 'A pediatric practice taking new patients, newborns included.', 'Board-certified pediatricians', 'Four pediatricians and a nurse line. Newborn visits are in the first days home, then well-child visits on the usual schedule. Most insurance plans.', ARRAY['in_person'], 30, 30),
('Riverside Children''s Clinic', 'pediatrician', 'Round Rock', 'TX', ARRAY['English','Vietnamese'], 0, 150, 'Pediatricians for babies and children, with same-week well visits.', 'Board-certified pediatricians', 'A clinic with early morning visits for working parents and a separate waiting room for well babies.', ARRAY['in_person'], 20, 30),
('Lakeview Pediatric Group', 'pediatrician', 'Chicago', 'IL', ARRAY['English','Polish'], 0, 170, 'Pediatric care from the newborn visit to the teens.', 'Board-certified pediatricians', 'A group practice with evening hours twice a week.', ARRAY['in_person','video'], 25, 30),
('Hill Country Women''s Health', 'obstetrician', 'Austin', 'TX', ARRAY['English','Spanish'], 0, 220, 'Obstetricians and midwives for prenatal care and birth.', 'Board-certified OB-GYNs and certified nurse midwives', 'Prenatal care with the same small team through the pregnancy, delivering at two Austin hospitals.', ARRAY['in_person'], 18, 30),
('Bayside Obstetrics', 'obstetrician', 'San Diego', 'CA', ARRAY['English','Spanish'], 0, 240, 'Prenatal visits, ultrasound and birth care.', 'Board-certified OB-GYNs', 'A practice with in-house ultrasound and a postpartum visit within three weeks of the birth.', ARRAY['in_person','video'], 15, 30),
('Mockingbird Doula Care', 'doula', 'San Antonio', 'TX', ARRAY['English','Spanish'], 0, 85, 'A doula for birth and the first nights home.', 'Certified birth and postpartum doula', 'Birth support plus overnight postpartum shifts so parents can sleep.', ARRAY['in_person','home'], 20, 60),
('Bloom Feeding Support', 'lactation_consultant', 'Austin', 'TX', ARRAY['English'], 0, 95, 'Feeding help at home, by breast, bottle or both.', 'IBCLC', 'Home visits within a day or two when feeding is hard, and a video follow-up a week later.', ARRAY['home','video'], 25, 60);

-- Open times are seeded lazily per family, a few weeks at a time, so they never
-- go stale and the demo clock's skips always land on open times. A family's
-- slots are its own: one demo session never takes another's times.
CREATE TABLE provider_slots (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id         uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    provider_id       uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    starts_at         timestamptz NOT NULL,
    duration_minutes  smallint NOT NULL CHECK (duration_minutes BETWEEN 15 AND 180),
    UNIQUE (family_id, provider_id, starts_at)
);
CREATE INDEX provider_slots_family_starts_idx ON provider_slots (family_id, starts_at);

-- The last day provider_slots are filled through for this family.
ALTER TABLE families ADD COLUMN provider_slots_through date;

-- A booking can reveal that a parent is seeking care. The parent picks who
-- sees it: private (only them) or family (their partner too, on the shared
-- calendar). Only the owner moves or cancels it; a cancel deletes the row.
CREATE TABLE provider_bookings (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id        uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visibility       text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','partner','care_team','family')),
    slot_id          uuid NOT NULL REFERENCES provider_slots(id) ON DELETE CASCADE,
    note             text CHECK (length(note) <= 500),
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_member_id, slot_id)
);
CREATE INDEX provider_bookings_family_created_idx ON provider_bookings (family_id, created_at DESC);
CREATE INDEX provider_bookings_slot_idx ON provider_bookings (slot_id);

-- +goose Down
DROP TABLE provider_bookings;
ALTER TABLE families DROP COLUMN provider_slots_through;
DROP TABLE provider_slots;
DELETE FROM providers WHERE type IN ('pediatrician','obstetrician') OR name IN ('Mockingbird Doula Care','Bloom Feeding Support');
ALTER TABLE providers DROP COLUMN credentials, DROP COLUMN bio, DROP COLUMN visit_modes, DROP COLUMN openings_pct, DROP COLUMN session_minutes;
ALTER TABLE providers DROP CONSTRAINT providers_type_check;
ALTER TABLE providers ADD CONSTRAINT providers_type_check CHECK (type IN ('perinatal_therapist','psychologist','doula','lactation_consultant','sleep_consultant','child_therapist','tutor'));
