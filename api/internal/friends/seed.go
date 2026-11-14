package friends

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// Seed gives a new demo family two synthetic friend families, already
// connected, with a few updates they shared and a reaction or two on the
// family's own shared note. The friend families are rows of their own
// (friend_of points at the demo family, so they go away with it), read through
// the same queries as a real connection. Names are invented.
func Seed(ctx context.Context, q *store.Queries, familyID uuid.UUID, today time.Time) error {
	parents, err := q.ListMembers(ctx, familyID)
	if err != nil || len(parents) == 0 {
		return err
	}
	at := func(daysAgo int, hour int) time.Time {
		return today.AddDate(0, 0, -daysAgo).Add(time.Duration(hour) * time.Hour)
	}
	type update struct {
		kind, body string
		headline   *string
		daysAgo    int
		hour       int
	}
	type friend struct {
		stage   string
		due     time.Time
		mother  string
		partner string
		since   int
		updates []update
	}
	str := func(s string) *string { return &s }
	friends := []friend{
		{
			stage: "pregnancy", due: today.AddDate(0, 0, 9*7), mother: "Ngozi", partner: "Ben", since: 40,
			updates: []update{
				{kind: "week", headline: str("Week 31 of pregnancy"), body: "Baby is about the size of a coconut and kicks hardest right after dinner.", daysAgo: 1, hour: 19},
				{kind: "note", body: "Packed the hospital bag today. Ben added three phone chargers and no socks.", daysAgo: 6, hour: 20},
			},
		},
		{
			stage: "infant", due: today.AddDate(0, -5, 0), mother: "Sara", partner: "Erik", since: 75,
			updates: []update{
				{kind: "moment", body: "Linnea rolled from her back to her tummy for the first time, then looked very surprised.", daysAgo: 2, hour: 10},
				{kind: "note", body: "First full night in her own crib. We checked on her four times anyway.", daysAgo: 9, hour: 8},
			},
		},
	}
	var friendParents, friendFamilies []uuid.UUID
	var friendUpdates []uuid.UUID
	for _, f := range friends {
		due := f.due
		id, err := q.CreateFriendFamily(ctx, store.CreateFriendFamilyParams{Stage: f.stage, DueDate: &due, FriendOf: uuid.NullUUID{UUID: familyID, Valid: true}})
		if err != nil {
			return err
		}
		mom, err := q.CreateMember(ctx, store.CreateMemberParams{FamilyID: id, Role: "mother", DisplayName: f.mother})
		if err != nil {
			return err
		}
		partner, err := q.CreateMember(ctx, store.CreateMemberParams{FamilyID: id, Role: "partner", DisplayName: f.partner})
		if err != nil {
			return err
		}
		friendParents = append(friendParents, mom.ID, partner.ID)
		friendFamilies = append(friendFamilies, id)
		if _, err := q.CreateFriendConnection(ctx, store.CreateFriendConnectionParams{
			RequesterFamily: id, AddresseeFamily: familyID, RequestedBy: uuid.NullUUID{UUID: mom.ID, Valid: true},
			Now: at(f.since, 12), AcceptedAt: ts(at(f.since-1, 9)),
		}); err != nil {
			return err
		}
		for i, u := range f.updates {
			author := mom.ID
			if i%2 == 1 {
				author = partner.ID
			}
			row, err := q.CreateFriendUpdate(ctx, store.CreateFriendUpdateParams{FamilyID: id, AuthorMemberID: author, Kind: u.kind, Headline: u.headline, Body: u.body, CreatedAt: at(u.daysAgo, u.hour)})
			if err != nil {
				return err
			}
			friendUpdates = append(friendUpdates, row.ID)
		}
	}

	// The family's own shared note, with a reaction from each friend family.
	mine, err := q.CreateFriendUpdate(ctx, store.CreateFriendUpdateParams{
		FamilyID: familyID, AuthorMemberID: parents[0].ID, Kind: "note",
		Body: "Sunday walk in the park, the first one without rain all week.", CreatedAt: at(3, 17),
	})
	if err != nil {
		return err
	}
	for i, r := range []string{"heart", "hug"} {
		if err := q.UpsertFriendReaction(ctx, store.UpsertFriendReactionParams{UpdateID: mine.ID, MemberID: friendParents[i*2], FamilyID: friendFamilies[i], Reaction: r, CreatedAt: at(3, 18+i)}); err != nil {
			return err
		}
	}
	// One of the friends' updates already has this family's reaction.
	return q.UpsertFriendReaction(ctx, store.UpsertFriendReactionParams{UpdateID: friendUpdates[2], MemberID: parents[len(parents)-1].ID, FamilyID: familyID, Reaction: "heart", CreatedAt: at(2, 12)})
}
