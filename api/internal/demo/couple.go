package demo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/access"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Compatibility Lab answers and time capsule letters for the demo families, so
// the lab opens with revealed cards (agreement and a conversation to have), a card
// waiting for one parent, and every family with a child or a baby on the way has a
// sealed letter. Synthetic text, days relative to today.

type labPick struct {
	card    string
	mother  string // "" = not answered
	partner string
}

var labStories = map[Template][]labPick{
	Pregnancy: {
		{"night-split", "a", "a"},
		{"visitors-first-weeks", "a", "b"},
		{"childcare-when", "c", "c"},
		{"money-baby-budget", "b", "a"},
		{"us-time", "a", "d"},
		{"values-crying", "", "b"},
		{"night-who-soothes", "d", ""},
	},
	Planning: {
		{"values-future", "a", "a"},
		{"money-save", "b", "d"},
		{"childcare-leave", "a", "a"},
		{"us-roles", "a", "c"},
		{"visitors-first-weeks", "", "a"},
	},
}

type seedLetter struct {
	by       who
	occasion string
	// Either years after the child's birth (or the due date), or days from today when years is 0.
	years, days int
	shared      bool
	body        string
}

var letterStories = map[Template][]seedLetter{
	Pregnancy: {
		{mother, "18th birthday", 18, 0, false, "Dear little one,\n\nYou are about the size of a mango while I write this and you kick every evening at nine. Your dad reads to my belly in a funny voice. Whatever you are doing today, we are proud of you, and the kitchen table is always open.\n\nLove, Mum"},
		{partner, "First day of school", 5, 0, true, "Hi buddy,\n\nI am writing this before I know your name. I hope your shoes fit, your lunch is good and someone saves you a seat. Be kind, be curious, and come home and tell me everything.\n\nDad"},
	},
	Planning: {
		{mother, "The day we find out", 0, 120, true, "Dear us,\n\nWe are writing this before the test, in the middle of the paperwork and the vitamins. Whatever the news is, we did this together, and I would still choose you.\n\nMaya"},
		{partner, "Our first anniversary as parents", 0, 600, false, "To the two of us, a year in. I hope we slept at least a little and that we still laugh at the same things. Thank you for starting this with me.\n\nDaniel"},
	},
	Newborn: {
		{mother, "First day of school", 5, 0, false, "My Leo,\n\nYou are seven weeks old and asleep on my arm. By the time you read this you will be a big kid with a backpack. I hope you know how many times you were held tonight.\n\nMama"},
		{partner, "18th birthday", 18, 0, true, "Leo,\n\nYou were born in the winter and the first thing you did was grab my finger. I will not remember to say it then, so here it is: I am glad you are mine.\n\nDad"},
	},
	Preschool: {
		{mother, "First day of school", 5, 0, true, "Ava,\n\nYou are four and you name every dog we pass. Next year you will walk into a classroom with your own bag. I will be the one waving too long at the gate.\n\nMum"},
		{partner, "16th birthday", 16, 0, false, "Ava,\n\nWhen you read this you may be rolling your eyes, which is allowed. Remember the dinner game where we each say one good thing from the day. It still works.\n\nDad"},
	},
}

// seedCouple writes the template's lab answers and letters. It does nothing for
// templates without a story (custom families).
func seedCouple(ctx context.Context, q *store.Queries, key crypt.Key, t Template, fam uuid.UUID, today time.Time) error {
	picks, letters := labStories[t], letterStories[t]
	if len(picks) == 0 && len(letters) == 0 {
		return nil
	}
	parents, err := q.ListMembers(ctx, fam)
	if err != nil || len(parents) != 2 {
		return err
	}
	ids := map[who]uuid.UUID{mother: parents[0].ID, partner: parents[1].ID}
	at := func(day, mins int) time.Time {
		return today.AddDate(0, 0, day).Add(21*time.Hour + time.Duration(mins)*time.Minute)
	}
	for i, p := range picks {
		for w, choice := range map[who]string{mother: p.mother, partner: p.partner} {
			if choice == "" {
				continue
			}
			if _, err := q.UpsertLabAnswer(ctx, store.UpsertLabAnswerParams{
				FamilyID: fam, MemberID: ids[w], CardID: p.card, ChoiceID: choice, AnsweredAt: at(-(len(picks) - i), int(w)*7),
			}); err != nil {
				return err
			}
		}
	}
	if len(letters) == 0 {
		return nil
	}
	kids, err := q.ListChildren(ctx, fam)
	if err != nil {
		return err
	}
	f, err := q.GetFamily(ctx, fam)
	if err != nil {
		return err
	}
	var child uuid.NullUUID
	var born time.Time
	switch {
	case len(kids) > 0:
		child, born = uuid.NullUUID{UUID: kids[0].ID, Valid: true}, kids[0].BirthDate
	case f.DueDate != nil:
		born = *f.DueDate
	}
	for i, l := range letters {
		opens := today.AddDate(0, 0, l.days)
		if l.years > 0 {
			opens = born.AddDate(l.years, 0, 0)
		}
		v := access.Private
		if l.shared {
			v = access.Partner
		}
		sealed, err := key.Seal(l.body)
		if err != nil {
			return err
		}
		if _, err := q.CreateLetter(ctx, store.CreateLetterParams{
			FamilyID: fam, OwnerMemberID: ids[l.by], ChildID: child, Visibility: string(v), Occasion: l.occasion,
			OpensOn: opens, BodySealed: sealed, Now: at(-2-i, 0),
		}); err != nil {
			return err
		}
	}
	return nil
}
