-- A parent's answer is shown to the other parent only when that parent answered
-- the same card. Mirrors the reveal rule in couplelab.Revealed.
-- name: ListLabAnswersRevealedToParent :many
SELECT * FROM lab_answers a
WHERE a.family_id = @family_id
  AND (a.member_id = @viewer_id
       OR EXISTS (SELECT 1 FROM lab_answers mine
                  WHERE mine.family_id = a.family_id AND mine.card_id = a.card_id AND mine.member_id = @viewer_id));

-- Who has answered which card, without the choice: lets the screen say "your partner answered".
-- name: ListLabAnsweredCards :many
SELECT member_id, card_id FROM lab_answers WHERE family_id = @family_id;

-- A second answer to a card changes it, until both parents answered (the domain checks).
-- name: UpsertLabAnswer :one
INSERT INTO lab_answers (family_id, member_id, card_id, choice_id, other_text, answered_at)
VALUES (@family_id, @member_id, @card_id, @choice_id, @other_text, @answered_at)
ON CONFLICT (member_id, card_id) DO UPDATE
SET choice_id = EXCLUDED.choice_id, other_text = EXCLUDED.other_text, answered_at = EXCLUDED.answered_at
WHERE lab_answers.family_id = EXCLUDED.family_id
RETURNING *;
