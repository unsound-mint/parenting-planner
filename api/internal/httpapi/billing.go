package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/unsound-mint/parenting-planner/api/internal/billing"
)

var (
	errPaymentsUnavailable = Error{Code: "payments_unavailable", Message: "payments are not set up on this server"}
	errAlreadySubscribed   = Error{Code: "already_subscribed", Message: "the family already has this plan"}
	errNoCheckout          = Error{Code: "not_found", Message: "no such checkout for this family"}
)

const stripeWebhookPath = "/api/billing/stripe-webhook"

// CreateCheckoutSession starts a Stripe Checkout for the family. Parents only:
// actingMember returns 404 for anyone else.
func (s *Server) CreateCheckoutSession(ctx context.Context, req CreateCheckoutSessionRequestObject) (CreateCheckoutSessionResponseObject, error) {
	familyID, m, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return CreateCheckoutSession401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return CreateCheckoutSession404JSONResponse(errNoMember), nil
	}
	if !s.cfg.Billing.Enabled() {
		return CreateCheckoutSession503JSONResponse(errPaymentsUnavailable), nil
	}
	sub, ok, err := billing.Current(ctx, s.q, familyID)
	if err != nil {
		return nil, err
	}
	if billing.Tier(sub, ok) == string(req.Body.Tier) {
		return CreateCheckoutSession409JSONResponse(errAlreadySubscribed), nil
	}
	cs, err := billing.CreateCheckout(ctx, s.cfg.Billing, familyID, m.ID, string(req.Body.Tier))
	if err != nil {
		return nil, err
	}
	return CreateCheckoutSession201JSONResponse(checkoutOut(cs, req.Body.Tier)), nil
}

// GetCheckoutSession reads the checkout back from Stripe for the success
// screen and applies the tier if it is paid, so the screen never waits for
// the webhook. Activate is idempotent with the webhook.
func (s *Server) GetCheckoutSession(ctx context.Context, req GetCheckoutSessionRequestObject) (GetCheckoutSessionResponseObject, error) {
	familyID, _, kind, err := s.actingMember(ctx, req.MemberId)
	switch {
	case err != nil:
		return nil, err
	case kind == errUnauthorized:
		return GetCheckoutSession401JSONResponse(errNoSession), nil
	case kind == errNotFound:
		return GetCheckoutSession404JSONResponse(errNoMember), nil
	}
	if !s.cfg.Billing.Enabled() {
		return GetCheckoutSession503JSONResponse(errPaymentsUnavailable), nil
	}
	cs, err := billing.GetCheckout(ctx, s.cfg.Billing, req.SessionId)
	if errors.Is(err, billing.ErrNotFound) {
		return GetCheckoutSession404JSONResponse(errNoCheckout), nil
	}
	if err != nil {
		return nil, err
	}
	// Only the family the checkout was created for may read or apply it.
	if id, ok := cs.FamilyID(); !ok || id != familyID || cs.Tier() == "" {
		return GetCheckoutSession404JSONResponse(errNoCheckout), nil
	}
	if _, err := billing.Activate(ctx, s.q, cs, s.cfg.Now()); err != nil {
		return nil, err
	}
	return GetCheckoutSession200JSONResponse(checkoutOut(cs, PaidTier(cs.Tier()))), nil
}

// HandleStripeWebhook runs only after verifyStripeSignature accepted the raw
// body, so the event is Stripe's.
func (s *Server) HandleStripeWebhook(ctx context.Context, req HandleStripeWebhookRequestObject) (HandleStripeWebhookResponseObject, error) {
	if !s.cfg.Billing.Enabled() {
		return HandleStripeWebhook503JSONResponse(errPaymentsUnavailable), nil
	}
	obj, err := json.Marshal(req.Body.Data["object"])
	if err != nil {
		return nil, err
	}
	ev := billing.Event{ID: req.Body.Id, Type: req.Body.Type, Object: obj}
	if err := billing.HandleEvent(ctx, s.pool, ev, s.cfg.Now()); err != nil {
		return nil, err
	}
	return HandleStripeWebhook200JSONResponse{Received: true}, nil
}

func checkoutOut(cs billing.Session, tier PaidTier) CheckoutSession {
	paid := cs.PaymentStatus == "paid"
	out := CheckoutSession{Id: cs.ID, Tier: tier, Status: CheckoutSessionStatus(cs.Status), Paid: &paid}
	if cs.Status == "open" && cs.URL != "" {
		out.Url = &cs.URL
	}
	return out
}

// verifyStripeSignature checks the Stripe-Signature header of the webhook
// against the raw body. It has to be a middleware: the strict handler only
// sees the decoded body, and re-encoding it would not reproduce the bytes
// Stripe signed. It runs before the request validator and restores r.Body.
func (s *Server) verifyStripeSignature(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != stripeWebhookPath {
			next.ServeHTTP(w, r)
			return
		}
		if !s.cfg.Billing.Enabled() {
			writeError(w, http.StatusServiceUnavailable, errPaymentsUnavailable.Code, errPaymentsUnavailable.Message)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request", "body too large or unreadable")
			return
		}
		if err := billing.VerifySignature(body, r.Header.Get("Stripe-Signature"), s.cfg.Billing.WebhookSecret, s.cfg.Now()); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_signature", "the Stripe-Signature header does not match the body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		next.ServeHTTP(w, r)
	})
}
