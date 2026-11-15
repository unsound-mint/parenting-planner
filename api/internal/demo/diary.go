package demo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

type diarySeed struct {
	by      who
	daysAgo int
	hour    int   // on the family's clock
	mood    int16 // 1 to 5
	shared  bool  // shared with the partner; every other entry stays private
	first   bool
	body    string
}

// diaryStories are 3 to 5 entries per parent over the last three weeks, matching each family's
// story. Emily's "birth anxiety" entry is not here: demo-script step 3 writes it live.
var diaryStories = map[Template][]diarySeed{
	Planning: {
		{mother, 19, 21, 4, false, false, "Got the preconception panel back. Rubella not immune, so I need the MMR before we try. Annoyed at myself for not checking sooner, but glad we found it now."},
		{mother, 11, 22, 4, true, false, "Daniel and I talked about timing over dinner. We agreed to wait for the vaccine window and keep the planning relaxed."},
		{mother, 4, 21, 3, false, false, "Tracking everything is starting to feel like homework. Taking a night off from the apps."},
		{partner, 16, 22, 3, false, false, "Checked my vaccine record. Tdap was eleven years ago, so that is on my list too. Feels good to have one concrete thing to do."},
		{partner, 8, 21, 4, false, false, "Maya was quiet after the lab results. I want to be more help than just saying it will be fine."},
		{partner, 3, 22, 4, false, false, "Looked at the budget with the parental leave numbers. Tight but doable if we plan a year ahead."},
	},
	Pregnancy: {
		{mother, 18, 21, 5, false, true, "First real kicks tonight, right under my ribs. Jake had his hand on my belly and missed it by a second. He was so disappointed."},
		{mother, 12, 22, 4, true, false, "Prenatal class with Jake was better than I expected. We practised breathing and he took notes. Sharing this one so he remembers how good it felt."},
		{mother, 7, 21, 3, false, false, "The back pain is waking me up at 3 am. The pillow fortress is not working. Writing this down to ask Dr. Shah."},
		{mother, 4, 20, 4, false, false, "Picked paint colours for the nursery. Jake wants yellow, I want green. We settled on a soft sage."},
		{partner, 15, 22, 4, false, true, "Felt the baby kick for the first time today. I did not expect to tear up in the living room."},
		{partner, 9, 21, 3, false, false, "Reading about the third trimester. A lot to get done before the baby comes and I am not sure where to start."},
		{partner, 2, 22, 4, false, false, "Ordered the crib. Emily laughed that I read forty reviews first. I want everything to be safe."},
	},
	Newborn: {
		{mother, 20, 14, 3, false, false, "Leo fed for forty minutes straight today. My back hurts and I did not finish my tea again, but he fell asleep on me and I did not want to move."},
		{mother, 13, 23, 3, false, false, "Cried in the shower today and could not say why. Felt better after a call with my sister."},
		{mother, 6, 15, 4, true, false, "Marcus has taken the night feeds this week and I slept five hours in a row. I told him thank you, but I want him to know how much it changed my day."},
		{mother, 2, 21, 4, false, true, "Walked to the park with Leo in the carrier for the first time. Twenty minutes, and it felt like a small victory."},
		{partner, 17, 2, 2, false, false, "Up at 2 am again. Feeling like a zombie at work and I snapped at a coworker. I do not want to bring that home."},
		{partner, 10, 23, 2, false, false, "Slept four hours. I love the nights with Leo, but I am running on empty."},
		{partner, 4, 22, 3, false, true, "Took the early shift so Aisha could sleep. Leo smiled at me, a real smile, I think."},
	},
	Preschool: {
		{mother, 18, 21, 4, false, false, "Ava's first week in the new classroom. She did not cry at drop-off, but I did a little in the car."},
		{mother, 10, 22, 3, false, false, "Bedtime took ninety minutes tonight. Three glasses of water, two stories, and a very serious question about where the moon goes."},
		{mother, 5, 21, 4, true, true, "Ava drew our whole family and gave Tom enormous hands. Taped it to the fridge. I want us to remember this stage."},
		{partner, 14, 22, 4, false, false, "Built a blanket fort with Ava. She named every stuffed animal as a guest and handed out tickets."},
		{partner, 7, 21, 3, false, false, "Work has been loud lately. I missed bedtime twice this week and I feel it."},
		{partner, 1, 22, 4, false, false, "Ava asked why the stars twinkle. I told her I did not know and we looked it up together. She was very pleased I did not know."},
	},
}

// seedDiary writes the entries the way the diary API does: the body is sealed with the server
// key and the author's own visibility applies. Mostly private, one entry per family shared with
// the partner so the per-entry sharing shows. It is a no-op for custom families.
func seedDiary(ctx context.Context, q *store.Queries, key crypt.Key, t Template, fam uuid.UUID, today time.Time) error {
	stories := diaryStories[t]
	if len(stories) == 0 {
		return nil
	}
	parents, err := q.ListMembers(ctx, fam)
	if err != nil || len(parents) != 2 {
		return err
	}
	ids := map[who]uuid.UUID{mother: parents[0].ID, partner: parents[1].ID}
	for _, e := range stories {
		sealed, err := key.Seal(e.body)
		if err != nil {
			return err
		}
		vis := access.Private
		if e.shared {
			vis = access.Partner
		}
		p := store.CreateDiaryEntryParams{
			FamilyID: fam, OwnerMemberID: ids[e.by], Visibility: string(vis),
			WrittenAt: atHour(today.AddDate(0, 0, -e.daysAgo), e.hour), BodySealed: sealed, IsFirst: e.first,
		}
		p.Mood.Int16, p.Mood.Valid = e.mood, true
		if _, err := q.CreateDiaryEntry(ctx, p); err != nil {
			return err
		}
	}
	return nil
}
