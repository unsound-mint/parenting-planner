// Package friends connects two families who know each other. They connect by
// an invite code that one family passes on and the other enters; the family
// that was asked accepts. After that each sees only the updates the other's
// parents shared with friends, one item at a time, as a copy. Nothing else of
// a family (diary, mood, health, plan, the child's records) is ever read here:
// queries/friends.sql names only the friend tables and the parents' first
// names, and store/conventions_test.go keeps it that way.
package friends

import (
	"context"
	"crypto/rand"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// CodeTTL is how long an invite code works.
const CodeTTL = 7 * 24 * time.Hour

// Window is how far back the updates list reaches.
const Window = 90 * 24 * time.Hour

var (
	ErrCodeNotFound     = errors.New("friends: no such code")
	ErrOwnCode          = errors.New("friends: this is the family's own code")
	ErrAlreadyConnected = errors.New("friends: already connected or asked")
	ErrNotFound         = errors.New("friends: not found")
)

// Reactions are presets only; there are no comments.
var Reactions = []string{"heart", "hug", "got_this"}

// codeAlphabet leaves out 0, 1, I and O so a code read aloud is not misheard.
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func newCode() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	out := make([]byte, 0, 9)
	for i, c := range b {
		if i == 4 {
			out = append(out, '-')
		}
		out = append(out, codeAlphabet[int(c)%len(codeAlphabet)])
	}
	return string(out), nil
}

// NormalizeCode accepts what a person types: any case, spaces, with or without the dash.
func NormalizeCode(s string) string {
	s = strings.ToUpper(strings.NewReplacer(" ", "", "-", "").Replace(s))
	if len(s) != 8 {
		return s
	}
	return s[:4] + "-" + s[4:]
}

// NewCode replaces the family's code.
func NewCode(ctx context.Context, q *store.Queries, familyID, memberID uuid.UUID, now time.Time) (store.FriendCode, error) {
	code, err := newCode()
	if err != nil {
		return store.FriendCode{}, err
	}
	return q.UpsertFriendCode(ctx, store.UpsertFriendCodeParams{FamilyID: familyID, Code: code, CreatedBy: memberID, Now: now, ExpiresAt: now.Add(CodeTTL)})
}

// Connect asks the family whose code this is. If that family had already
// asked this one, their request is accepted instead: both sides agreed.
func Connect(ctx context.Context, pool *pgxpool.Pool, familyID, memberID uuid.UUID, code string, now time.Time) (uuid.UUID, error) {
	var id uuid.UUID
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		other, err := q.FindFriendCode(ctx, store.FindFriendCodeParams{Code: NormalizeCode(code), Now: now})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCodeNotFound
		}
		if err != nil {
			return err
		}
		if other == familyID {
			return ErrOwnCode
		}
		conns, err := q.ListFriendConnections(ctx, familyID)
		if err != nil {
			return err
		}
		for _, c := range conns {
			if c.OtherFamily != other {
				continue
			}
			if c.AcceptedAt.Valid || c.Outgoing {
				return ErrAlreadyConnected
			}
			if _, err := q.AcceptFriendConnection(ctx, store.AcceptFriendConnectionParams{Now: ts(now), ID: c.ID, FamilyID: familyID}); err != nil {
				return err
			}
			id = c.ID
			return nil
		}
		c, err := q.CreateFriendConnection(ctx, store.CreateFriendConnectionParams{
			RequesterFamily: familyID, AddresseeFamily: other, RequestedBy: uuid.NullUUID{UUID: memberID, Valid: true}, Now: now,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			// ON CONFLICT DO NOTHING: a request crossed this one.
			return ErrAlreadyConnected
		}
		id = c.ID
		return err
	})
	return id, err
}

// Accept accepts a request this family received.
func Accept(ctx context.Context, q *store.Queries, familyID, connectionID uuid.UUID, now time.Time) error {
	_, err := q.AcceptFriendConnection(ctx, store.AcceptFriendConnectionParams{Now: ts(now), ID: connectionID, FamilyID: familyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

// Disconnect ends a connection or a request from either side, and takes each
// family's reactions off the other's updates.
func Disconnect(ctx context.Context, pool *pgxpool.Pool, familyID, connectionID uuid.UUID) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		other, err := q.DeleteFriendConnection(ctx, store.DeleteFriendConnectionParams{ID: connectionID, FamilyID: familyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		return q.DeleteReactionsBetween(ctx, store.DeleteReactionsBetweenParams{A: familyID, B: other})
	})
}

// Connection is one friend family as the viewer sees it.
type Connection struct {
	ID        uuid.UUID
	Family    uuid.UUID
	Names     []string
	Status    string // connected, incoming or outgoing
	Since     time.Time
	Connected bool
}

// Update is one shared item with the reactions the viewer may see.
type Update struct {
	store.ListFriendUpdatesRow
	Mine         bool
	ConnectionID uuid.UUID
	FamilyNames  []string
	Reactions    []store.ListVisibleFriendReactionsRow
}

// Overview is everything the Friends screen shows.
type Overview struct {
	Code        *store.FriendCode
	Connections []Connection
	Updates     []Update
}

// Load reads the viewer family's friends, its own and its friends' updates,
// and the reactions it may see.
func Load(ctx context.Context, q *store.Queries, familyID uuid.UUID, now time.Time) (Overview, error) {
	var out Overview
	code, err := q.GetFriendCode(ctx, store.GetFriendCodeParams{FamilyID: familyID, Now: now})
	switch {
	case err == nil:
		out.Code = &code
	case !errors.Is(err, pgx.ErrNoRows):
		return out, err
	}
	conns, err := q.ListFriendConnections(ctx, familyID)
	if err != nil {
		return out, err
	}
	parents, err := q.ListFriendFamilyParents(ctx, familyID)
	if err != nil {
		return out, err
	}
	names := map[uuid.UUID][]string{}
	for _, p := range parents {
		names[p.FamilyID] = append(names[p.FamilyID], p.DisplayName)
	}
	byFamily := map[uuid.UUID]Connection{}
	for _, c := range conns {
		x := Connection{ID: c.ID, Family: c.OtherFamily, Names: names[c.OtherFamily], Since: c.CreatedAt, Connected: c.AcceptedAt.Valid}
		switch {
		case c.AcceptedAt.Valid:
			x.Status, x.Since = "connected", c.AcceptedAt.Time
		case c.Outgoing:
			x.Status = "outgoing"
		default:
			x.Status = "incoming"
		}
		if x.Names == nil {
			x.Names = []string{}
		}
		out.Connections = append(out.Connections, x)
		byFamily[c.OtherFamily] = x
	}
	rows, err := q.ListFriendUpdates(ctx, store.ListFriendUpdatesParams{FamilyID: familyID, Since: now.Add(-Window)})
	if err != nil {
		return out, err
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ID)
	}
	reactions, err := q.ListVisibleFriendReactions(ctx, store.ListVisibleFriendReactionsParams{UpdateIds: ids, FamilyID: familyID})
	if err != nil {
		return out, err
	}
	byUpdate := map[uuid.UUID][]store.ListVisibleFriendReactionsRow{}
	for _, r := range reactions {
		byUpdate[r.UpdateID] = append(byUpdate[r.UpdateID], r)
	}
	for _, r := range rows {
		u := Update{ListFriendUpdatesRow: r, Mine: r.FamilyID == familyID, Reactions: byUpdate[r.ID], FamilyNames: []string{}}
		if !u.Mine {
			c := byFamily[r.FamilyID]
			u.ConnectionID, u.FamilyNames = c.ID, c.Names
		}
		out.Updates = append(out.Updates, u)
	}
	return out, nil
}

// Share stores a copy of what a parent chose to share with friends.
func Share(ctx context.Context, q *store.Queries, familyID, memberID uuid.UUID, kind string, headline *string, body string, now time.Time) (store.FriendUpdate, error) {
	return q.CreateFriendUpdate(ctx, store.CreateFriendUpdateParams{
		FamilyID: familyID, AuthorMemberID: memberID, Kind: kind, Headline: headline, Body: strings.TrimSpace(body), CreatedAt: now,
	})
}

// Unshare removes an update; only its author can.
func Unshare(ctx context.Context, q *store.Queries, familyID, memberID, updateID uuid.UUID) error {
	n, err := q.DeleteFriendUpdate(ctx, store.DeleteFriendUpdateParams{ID: updateID, FamilyID: familyID, AuthorMemberID: memberID})
	if err == nil && n == 0 {
		return ErrNotFound
	}
	return err
}

// React sets or, with reaction "", removes the member's reaction on an update
// they can see.
func React(ctx context.Context, q *store.Queries, familyID, memberID, updateID uuid.UUID, reaction string, now time.Time) error {
	if _, err := q.GetVisibleFriendUpdate(ctx, store.GetVisibleFriendUpdateParams{ID: updateID, FamilyID: familyID}); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if reaction == "" {
		return q.DeleteFriendReaction(ctx, store.DeleteFriendReactionParams{UpdateID: updateID, MemberID: memberID})
	}
	return q.UpsertFriendReaction(ctx, store.UpsertFriendReactionParams{UpdateID: updateID, MemberID: memberID, FamilyID: familyID, Reaction: reaction, CreatedAt: now})
}

func ts(t time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: t, Valid: true} }
