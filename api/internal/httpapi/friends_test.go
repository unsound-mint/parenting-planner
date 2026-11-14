package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func friendsPath(p httpapi.Parent) string { return "/api/members/" + p.Id.String() }

func friendsOf(t *testing.T, c *testutil.Client, p httpapi.Parent) httpapi.Friends {
	t.Helper()
	var f httpapi.Friends
	c.Get(friendsPath(p)+"/friends", http.StatusOK, &f)
	return f
}

// A new demo copy comes with two connected synthetic friend families, their
// shared updates, and the family's own note with a reaction from each.
func TestDemoFamilyHasTwoFriendFamilies(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	f := friendsOf(t, c, mom)
	if len(f.Families) != 2 {
		t.Fatalf("got %d friend families, want 2", len(f.Families))
	}
	for _, x := range f.Families {
		if x.Status != httpapi.Connected || len(x.Names) != 2 {
			t.Errorf("friend family %+v: want connected with two parents", x)
		}
	}
	var mine, theirs int
	for _, u := range f.Updates {
		if u.Mine {
			mine++
			if len(u.Reactions) != 2 {
				t.Errorf("own update has %d reactions, want one from each friend family", len(u.Reactions))
			}
			continue
		}
		theirs++
		// On a friend's update the family sees only its own reactions.
		for _, r := range u.Reactions {
			if r.Name != mom.DisplayName && r.Name != testutil.Parent(t, fam, httpapi.ParentRolePartner).DisplayName {
				t.Errorf("friend update %s shows %s's reaction", u.Id, r.Name)
			}
		}
	}
	if mine != 1 || theirs != 4 {
		t.Errorf("got %d own and %d friend updates, want 1 and 4", mine, theirs)
	}
	// Analytics counts visitors, not their synthetic friends.
	var n int
	if err := c.Pool.QueryRow(t.Context(), "SELECT count(*) FROM families WHERE friend_of = $1", fam.Id).Scan(&n); err != nil || n != 2 {
		t.Errorf("friend families of the demo: %d (%v), want 2", n, err)
	}
}

// Two families connect by code, both agreeing; until then nothing is shared.
// Afterwards each sees only the other's shared updates (never a diary entry or
// a mood note), reactions stay within the family that gave them, and either
// side can disconnect, which takes the updates and reactions away.
func TestFriendFamiliesSeeOnlyWhatIsShared(t *testing.T) {
	a := testutil.New(t)
	famA := a.StartDemo("pregnancy")
	momA := testutil.Parent(t, famA, httpapi.ParentRoleMother)
	partnerA := testutil.Parent(t, famA, httpapi.ParentRolePartner)
	b := testutil.New(t)
	famB := b.StartDemo("preschool")
	momB := testutil.Parent(t, famB, httpapi.ParentRoleMother)

	// Private and partner-shared records of A that must never reach B.
	a.Post(friendsPath(momA)+"/diary-entries", map[string]any{"body": "SECRET-DIARY worried about money", "visibility": "family"}, http.StatusCreated, nil)
	a.Post(friendsPath(momA)+"/mood-checkins", map[string]any{"mood": 2, "energy": 2, "sleepHours": 5, "note": "SECRET-MOOD rough night", "visibility": "family"}, http.StatusCreated, nil)
	var shared httpapi.FriendUpdate
	a.Post(friendsPath(momA)+"/friend-updates", httpapi.FriendUpdateInput{Kind: httpapi.Week, Body: "Kicks every evening now."}, http.StatusCreated, &shared)
	if shared.Headline == nil || *shared.Headline != "Week 25 of pregnancy" || !shared.AuthoredByMe {
		t.Errorf("week card %+v: want the server's headline", shared)
	}

	var code httpapi.FriendCode
	a.Post(friendsPath(momA)+"/friend-code", nil, http.StatusCreated, &code)
	a.Post(friendsPath(momA)+"/friend-connections", httpapi.FriendCodeInput{Code: code.Code}, http.StatusConflict, nil)
	b.Post(friendsPath(momB)+"/friend-connections", httpapi.FriendCodeInput{Code: "ZZZZ-ZZZZ"}, http.StatusNotFound, nil)

	var req httpapi.FriendFamily
	b.Post(friendsPath(momB)+"/friend-connections", httpapi.FriendCodeInput{Code: strings.ToLower(strings.ReplaceAll(code.Code, "-", ""))}, http.StatusCreated, &req)
	if req.Status != httpapi.Outgoing {
		t.Errorf("status %s, want outgoing", req.Status)
	}
	b.Post(friendsPath(momB)+"/friend-connections", httpapi.FriendCodeInput{Code: code.Code}, http.StatusConflict, nil)
	// The side that asked cannot accept its own request.
	b.Post(friendsPath(momB)+"/friend-connections/"+req.ConnectionId.String()+"/accept", nil, http.StatusNotFound, nil)
	for _, u := range friendsOf(t, b, momB).Updates {
		if u.Id == shared.Id {
			t.Fatal("a pending request already shows the other family's updates")
		}
	}
	var incoming *httpapi.FriendFamily
	for _, x := range friendsOf(t, a, momA).Families {
		if x.ConnectionId == req.ConnectionId {
			incoming = &x
		}
	}
	if incoming == nil || incoming.Status != httpapi.Incoming {
		t.Fatalf("A does not see B's request as incoming: %+v", incoming)
	}
	// The other parent of A may accept for the family.
	a.Post(friendsPath(partnerA)+"/friend-connections/"+req.ConnectionId.String()+"/accept", nil, http.StatusOK, nil)

	status, raw := b.Raw(http.MethodGet, friendsPath(momB)+"/friends", "", nil)
	if status != http.StatusOK {
		t.Fatalf("friends: %d", status)
	}
	for _, leak := range []string{"SECRET-DIARY", "SECRET-MOOD", "Linda", "Maria"} {
		if strings.Contains(string(raw), leak) {
			t.Errorf("B's friends view contains %q", leak)
		}
	}
	fb := friendsOf(t, b, momB)
	var seen *httpapi.FriendUpdate
	for _, u := range fb.Updates {
		if u.Id == shared.Id {
			seen = &u
		}
		// B's seeded friends are not A's: A's updates are the only new ones.
	}
	if seen == nil || seen.Mine || seen.AuthoredByMe || seen.ConnectionId != req.ConnectionId {
		t.Fatalf("B does not see A's shared update properly: %+v", seen)
	}
	// B cannot remove A's update; B reacts with a preset only.
	b.Delete(friendsPath(momB)+"/friend-updates/"+shared.Id.String(), http.StatusNotFound, nil)
	b.Put(friendsPath(momB)+"/friend-updates/"+shared.Id.String()+"/reaction", map[string]string{"reaction": "applause"}, http.StatusBadRequest, nil)
	b.Put(friendsPath(momB)+"/friend-updates/"+shared.Id.String()+"/reaction", httpapi.FriendReactionInput{Reaction: httpapi.Hug}, http.StatusNoContent, nil)

	// A sees who reacted on its own update.
	reacted := false
	for _, u := range friendsOf(t, a, momA).Updates {
		if u.Id == shared.Id {
			for _, r := range u.Reactions {
				reacted = reacted || (r.Name == momB.DisplayName && r.Reaction == httpapi.Hug)
			}
		}
	}
	if !reacted {
		t.Error("A does not see B's reaction on its update")
	}
	// A's seeded note carries reactions from A's other friends; B sees none of
	// them, so B never learns who else A is friends with.
	for _, u := range friendsOf(t, b, momB).Updates {
		if !u.Mine && u.ConnectionId == req.ConnectionId && u.Id != shared.Id && len(u.Reactions) != 0 {
			t.Errorf("B sees other families' reactions on A's update: %+v", u.Reactions)
		}
	}

	// A caregiver of either family gets nothing.
	for _, cg := range famA.Caregivers {
		a.Get("/api/members/"+cg.Id.String()+"/friends", http.StatusNotFound, nil)
		a.Post("/api/members/"+cg.Id.String()+"/friend-updates", httpapi.FriendUpdateInput{Kind: httpapi.Note, Body: "x"}, http.StatusNotFound, nil)
	}
	// Another family's session cannot act as A's parent.
	b.Get(friendsPath(momA)+"/friends", http.StatusNotFound, nil)

	// B disconnects: A's update and B's reaction are gone for both.
	b.Delete(friendsPath(momB)+"/friend-connections/"+req.ConnectionId.String(), http.StatusNoContent, nil)
	for _, u := range friendsOf(t, b, momB).Updates {
		if u.Id == shared.Id {
			t.Error("B still sees A's update after disconnecting")
		}
	}
	for _, u := range friendsOf(t, a, momA).Updates {
		if u.Id == shared.Id && len(u.Reactions) != 0 {
			t.Errorf("B's reaction outlived the connection: %+v", u.Reactions)
		}
	}
	b.Put(friendsPath(momB)+"/friend-updates/"+shared.Id.String()+"/reaction", httpapi.FriendReactionInput{Reaction: httpapi.Heart}, http.StatusNotFound, nil)
}

// Only the author removes an update; the other parent of the family cannot.
func TestOnlyTheAuthorRemovesAnUpdate(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var u httpapi.FriendUpdate
	c.Post(friendsPath(mom)+"/friend-updates", httpapi.FriendUpdateInput{Kind: httpapi.Moment, Body: "First smile."}, http.StatusCreated, &u)
	c.Post(friendsPath(mom)+"/friend-updates", httpapi.FriendUpdateInput{Kind: httpapi.Note, Body: strings.Repeat("a", 281)}, http.StatusBadRequest, nil)
	c.Delete(friendsPath(partner)+"/friend-updates/"+u.Id.String(), http.StatusNotFound, nil)
	c.Delete(friendsPath(mom)+"/friend-updates/"+u.Id.String(), http.StatusNoContent, nil)
	c.Delete(friendsPath(mom)+"/friend-updates/"+u.Id.String()+"/reaction", http.StatusNotFound, nil)
}
