package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/unsound-mint/parenting-planner/api/internal/billing"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

const webhookSecret = "whsec_test_billing"

// fakeStripe stands in for api.stripe.com: it creates and returns checkout
// sessions, so CI needs no network and no keys.
type fakeStripe struct {
	mu       sync.Mutex
	sessions map[string]map[string]any
	lastForm url.Values
	lastAuth string
}

func newFakeStripe(t *testing.T) (*fakeStripe, *httptest.Server) {
	f := &fakeStripe{sessions: map[string]map[string]any{}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		f.lastAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v1/checkout/sessions":
			_ = r.ParseForm()
			f.lastForm = r.PostForm
			id := fmt.Sprintf("cs_test_%d", len(f.sessions)+1)
			s := map[string]any{
				"id": id, "object": "checkout.session", "status": "open", "payment_status": "unpaid",
				"url": "https://checkout.stripe.com/c/pay/" + id, "customer": nil, "subscription": nil,
				"metadata": map[string]string{
					"family_id": r.PostForm.Get("metadata[family_id]"),
					"member_id": r.PostForm.Get("metadata[member_id]"),
					"tier":      r.PostForm.Get("metadata[tier]"),
				},
			}
			f.sessions[id] = s
			_ = json.NewEncoder(w).Encode(s)
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/v1/checkout/sessions/"):
			s, ok := f.sessions[strings.TrimPrefix(r.URL.Path, "/v1/checkout/sessions/")]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"error":{"type":"invalid_request_error","code":"resource_missing","message":"No such checkout.session"}}`))
				return
			}
			_ = json.NewEncoder(w).Encode(s)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return f, srv
}

// pay marks a session as paid, as Stripe does when the test card goes through.
func (f *fakeStripe) pay(id string) map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	s := f.sessions[id]
	s["status"], s["payment_status"], s["url"] = "complete", "paid", nil
	s["customer"], s["subscription"] = "cus_test_1", "sub_test_1"
	return s
}

// billingClient is a visitor on an API whose Stripe is the fake at stripeURL.
func billingClient(t *testing.T, stripeURL string) *testutil.Client {
	return testutil.NewWithConfig(t, httpapi.Config{Billing: billing.Config{
		SecretKey: "sk_test_fake", WebhookSecret: webhookSecret,
		PublicBaseURL: "https://parenting.example", APIBase: stripeURL,
	}})
}

// postWebhook sends a Stripe event signed over the exact bytes it posts.
func postWebhook(c *testutil.Client, event any, secret string, want int) httpapi.Error {
	b, _ := json.Marshal(event)
	header := billing.SignatureHeader(b, secret, testutil.Now.Unix())
	var e httpapi.Error
	c.PostWithHeaders("/api/billing/stripe-webhook", map[string]string{"Stripe-Signature": header}, json.RawMessage(b), want, &e)
	return e
}

func familyTier(c *testutil.Client) httpapi.Family {
	var fam httpapi.Family
	c.Get("/api/family", http.StatusOK, &fam)
	return fam
}

func TestPaymentsUnavailableWithoutKeys(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	m := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	var e httpapi.Error
	c.Post(m+"/checkout-sessions", map[string]any{"tier": "plus"}, http.StatusServiceUnavailable, &e)
	if e.Code != "payments_unavailable" {
		t.Errorf("create: code %q", e.Code)
	}
	c.Get(m+"/checkout-sessions/cs_test_123", http.StatusServiceUnavailable, &e)
	if e.Code != "payments_unavailable" {
		t.Errorf("get: code %q", e.Code)
	}
	if e := postWebhook(c, map[string]any{"id": "evt_1", "type": "checkout.session.completed", "data": map[string]any{}}, webhookSecret, http.StatusServiceUnavailable); e.Code != "payments_unavailable" {
		t.Errorf("webhook: code %q", e.Code)
	}
	if got := familyTier(c); *got.Tier != httpapi.TierFree || got.Subscription != nil {
		t.Errorf("tier %v, subscription %v", *got.Tier, got.Subscription)
	}
}

func TestCheckoutUnlocksBothParents(t *testing.T) {
	stripe, srv := newFakeStripe(t)
	c := billingClient(t, srv.URL)
	fam := c.StartDemo("pregnancy")
	mother := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	partner := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRolePartner).Id.String()

	var cs httpapi.CheckoutSession
	c.Post(mother+"/checkout-sessions", map[string]any{"tier": "plus"}, http.StatusCreated, &cs)
	if cs.Status != httpapi.CheckoutSessionStatusOpen || cs.Url == nil || cs.Tier != httpapi.PaidTierPlus {
		t.Fatalf("created %+v", cs)
	}
	form := stripe.lastForm
	for k, want := range map[string]string{
		"mode":                                   "subscription",
		"success_url":                            "https://parenting.example/pricing/success?session_id={CHECKOUT_SESSION_ID}",
		"cancel_url":                             "https://parenting.example/pricing",
		"metadata[family_id]":                    fam.Id.String(),
		"subscription_data[metadata][family_id]": fam.Id.String(),
		"line_items[0][price_data][unit_amount]": "2900",
		"line_items[0][price_data][recurring][interval]": "month",
	} {
		if form.Get(k) != want {
			t.Errorf("form %s = %q, want %q", k, form.Get(k), want)
		}
	}
	if stripe.lastAuth != "Bearer sk_test_fake" {
		t.Errorf("auth header %q", stripe.lastAuth)
	}

	// Before payment the success screen sees an open session and nothing changes.
	var got httpapi.CheckoutSession
	c.Get(mother+"/checkout-sessions/"+cs.Id, http.StatusOK, &got)
	if got.Status != httpapi.CheckoutSessionStatusOpen || *got.Paid || *familyTier(c).Tier != httpapi.TierFree {
		t.Fatalf("unpaid: %+v", got)
	}

	// Paid, and no webhook yet: the success screen applies the tier itself.
	stripe.pay(cs.Id)
	got = httpapi.CheckoutSession{}
	c.Get(partner+"/checkout-sessions/"+cs.Id, http.StatusOK, &got)
	if got.Status != httpapi.CheckoutSessionStatusComplete || !*got.Paid || got.Url != nil {
		t.Fatalf("paid: %+v", got)
	}
	f := familyTier(c)
	if *f.Tier != httpapi.TierPlus || f.Subscription == nil || f.Subscription.Status != httpapi.SubscriptionStatusActive {
		t.Fatalf("family after payment: tier %v, subscription %+v", *f.Tier, f.Subscription)
	}

	var e httpapi.Error
	c.Post(partner+"/checkout-sessions", map[string]any{"tier": "plus"}, http.StatusConflict, &e)
	if e.Code != "already_subscribed" {
		t.Errorf("second checkout: code %q", e.Code)
	}

	// Another family cannot read or apply this checkout, and unknown ids are 404.
	other := billingClient(t, srv.URL)
	otherFam := other.StartDemo("pregnancy")
	otherMother := "/api/members/" + testutil.Parent(t, otherFam, httpapi.ParentRoleMother).Id.String()
	other.Get(otherMother+"/checkout-sessions/"+cs.Id, http.StatusNotFound, &e)
	other.Get(otherMother+"/checkout-sessions/cs_test_missing", http.StatusNotFound, &e)
	if *familyTier(other).Tier != httpapi.TierFree {
		t.Error("another family got the plan")
	}
}

func TestStripeWebhookIsVerifiedAndIdempotent(t *testing.T) {
	stripe, srv := newFakeStripe(t)
	c := billingClient(t, srv.URL)
	fam := c.StartDemo("pregnancy")
	mother := "/api/members/" + testutil.Parent(t, fam, httpapi.ParentRoleMother).Id.String()
	var cs httpapi.CheckoutSession
	c.Post(mother+"/checkout-sessions", map[string]any{"tier": "concierge"}, http.StatusCreated, &cs)
	// Event ids must be unique across runs: stripe_events outlives the test family.
	evt := "evt_" + fam.Id.String()
	completed := map[string]any{
		"id": evt, "object": "event", "type": "checkout.session.completed",
		"data": map[string]any{"object": stripe.pay(cs.Id)},
	}

	// A wrong signature is rejected before anything is read.
	if e := postWebhook(c, completed, "whsec_wrong", http.StatusBadRequest); e.Code != "invalid_signature" {
		t.Errorf("bad signature: code %q", e.Code)
	}
	if *familyTier(c).Tier != httpapi.TierFree {
		t.Fatal("unsigned event changed the tier")
	}

	var receipt httpapi.WebhookReceipt
	b, _ := json.Marshal(completed)
	c.PostWithHeaders("/api/billing/stripe-webhook", map[string]string{"Stripe-Signature": billing.SignatureHeader(b, webhookSecret, testutil.Now.Unix())}, json.RawMessage(b), http.StatusOK, &receipt)
	if !receipt.Received || *familyTier(c).Tier != httpapi.TierConcierge {
		t.Fatalf("after completed: receipt %+v tier %v", receipt, *familyTier(c).Tier)
	}

	// Canceling the subscription returns the family to free.
	postWebhook(c, map[string]any{
		"id": evt + "_deleted", "type": "customer.subscription.deleted",
		"data": map[string]any{"object": map[string]any{"id": "sub_test_1", "object": "subscription", "metadata": map[string]string{"family_id": fam.Id.String()}}},
	}, webhookSecret, http.StatusOK)
	if f := familyTier(c); *f.Tier != httpapi.TierFree || f.Subscription.Status != httpapi.SubscriptionStatusCanceled {
		t.Fatalf("after deleted: tier %v, subscription %+v", *f.Tier, f.Subscription)
	}

	// A redelivered completed event and a late success screen change nothing.
	postWebhook(c, completed, webhookSecret, http.StatusOK)
	var got httpapi.CheckoutSession
	c.Get(mother+"/checkout-sessions/"+cs.Id, http.StatusOK, &got)
	if *familyTier(c).Tier != httpapi.TierFree {
		t.Error("replayed checkout re-activated a canceled plan")
	}
	var n int
	if err := c.Pool.QueryRow(context.Background(), `SELECT count(*) FROM stripe_events WHERE id = $1`, evt).Scan(&n); err != nil || n != 1 {
		t.Errorf("stripe_events rows = %d, err %v", n, err)
	}

	// Events for a family that no longer exists, and unrelated event types,
	// are acknowledged so Stripe stops retrying.
	postWebhook(c, map[string]any{
		"id": evt + "_gone", "type": "checkout.session.completed",
		"data": map[string]any{"object": map[string]any{"id": "cs_gone", "status": "complete", "payment_status": "paid", "metadata": map[string]string{"family_id": "00000000-0000-0000-0000-000000000000", "tier": "plus"}}},
	}, webhookSecret, http.StatusOK)
	postWebhook(c, map[string]any{"id": evt + "_other", "type": "invoice.paid", "data": map[string]any{"object": map[string]any{}}}, webhookSecret, http.StatusOK)
}
