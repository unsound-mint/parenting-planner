package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

const (
	// livePoll is how often the stream looks for new events; with the browser's
	// refetch a change shows on another screen within about a second.
	livePoll = 500 * time.Millisecond
	// livePing keeps proxies from closing an idle stream.
	livePing = 15 * time.Second
)

// liveUpdate is the data of one "update" event: the contract's LiveUpdate schema,
// which no response references, so the generator does not emit it.
type liveUpdate struct {
	Kind     string    `json:"kind"`
	EntityID *string   `json:"entityId,omitempty"`
	ActorID  uuid.UUID `json:"actorId"`
	At       time.Time `json:"at"`
}

// liveStream is the response of getLiveUpdates. The generated response type
// copies a reader and never flushes, so this one writes and flushes each event.
type liveStream struct {
	ctx      context.Context
	q        *store.Queries
	familyID uuid.UUID
	person   store.Member
	after    int64
}

func (l liveStream) VisitGetLiveUpdatesResponse(w http.ResponseWriter) error {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return fmt.Errorf("response writer cannot stream")
	}
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("X-Accel-Buffering", "no") // tell nginx-style proxies not to buffer
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	poll, ping := time.NewTicker(livePoll), time.NewTicker(livePing)
	defer poll.Stop()
	defer ping.Stop()
	for {
		select {
		case <-l.ctx.Done():
			return nil
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		case <-poll.C:
			// Look the person up again each time: a revoked caregiver stops hearing about the family
			// at once, and a changed permission applies to a stream that is already open.
			person, err := l.q.GetPerson(l.ctx, store.GetPersonParams{ID: l.person.ID, FamilyID: l.familyID})
			if err != nil {
				return nil // no longer a person with access (or the database failed): the client reconnects
			}
			perms := person.Permissions
			if perms == nil {
				perms = []string{}
			}
			rows, err := l.q.ListLiveEventsSince(l.ctx, store.ListLiveEventsSinceParams{
				FamilyID: l.familyID, AfterID: l.after, MemberID: person.ID, IsParent: isParentRole(person.Role), Permissions: perms,
			})
			if err != nil {
				return nil // the client reconnects and refetches
			}
			for _, r := range rows {
				l.after = r.ID
				u := liveUpdate{Kind: r.Kind, ActorID: r.ActorMemberID, At: r.At, EntityID: r.EntityID}
				b, err := json.Marshal(u)
				if err != nil {
					return err
				}
				fmt.Fprintf(w, "id: %d\nevent: update\ndata: %s\n\n", r.ID, b)
			}
			if len(rows) > 0 {
				flusher.Flush()
			}
		}
	}
}

func (s *Server) GetLiveUpdates(ctx context.Context, req GetLiveUpdatesRequestObject) (GetLiveUpdatesResponseObject, error) {
	familyID, m, kind, err := s.actingPerson(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetLiveUpdates401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetLiveUpdates404JSONResponse(errNoMember), nil
	}
	// Only changes from now on: a client that (re)connects refetches what it shows.
	after, err := s.q.MaxLiveEventID(ctx, familyID)
	if err != nil {
		return nil, err
	}
	return liveStream{ctx: ctx, q: s.q, familyID: familyID, person: m, after: after}, nil
}
