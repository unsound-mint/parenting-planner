// Package billing takes payments for the paid tiers through Stripe Checkout
// in test mode. Stripe is called over plain REST (a form POST and a GET), so
// there is no Stripe module. One subscription covers the whole family: both
// parents read Family.tier, which is derived from the subscriptions row.
//
// Keys come only from the server environment (deploy/.env on the server).
// They are never logged and never sent to the browser.
package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

// StripeVersion pins the API version of our requests, so a change of the
// account's default version cannot change the response shape. The webhook
// payload version is set separately on the endpoint in the Stripe dashboard.
const StripeVersion = "2026-10-28.endive"

// Config is optional: without it the billing endpoints answer 503
// payments_unavailable and every family stays on free.
type Config struct {
	SecretKey     string // sk_test_...
	WebhookSecret string // whsec_...
	// PublicBaseURL is where Stripe sends the visitor back, e.g.
	// https://parenting.unsoundmint.com, without a trailing slash.
	PublicBaseURL string
	// APIBase is https://api.stripe.com unless a test points it elsewhere.
	APIBase string
	HTTP    *http.Client
}

// FromEnv reads STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and PUBLIC_BASE_URL.
func FromEnv() Config {
	return Config{
		SecretKey:     strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")),
		WebhookSecret: strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET")),
		PublicBaseURL: strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")), "/"),
	}
}

// Enabled reports whether all three settings are present. Half a setup
// (a key but no webhook secret) is treated as off, so a payment can never
// succeed at Stripe without a way to apply it here.
func (c Config) Enabled() bool {
	return c.SecretKey != "" && c.WebhookSecret != "" && c.PublicBaseURL != ""
}

func (c Config) apiBase() string {
	if c.APIBase != "" {
		return c.APIBase
	}
	return "https://api.stripe.com"
}

func (c Config) client() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 15 * time.Second}
}

// Prices in cents per billing interval, sent inline as price_data so no
// Stripe price ids are needed. A missing interval means the tier is not
// offered that way. Keep in step with web/src/lib/plans.ts.
var tiers = map[string]struct {
	name  string
	cents map[string]int
}{
	"plus": {"Parenting Planner Plus", map[string]int{"month": 1499, "year": 11999}},
}

// Offered reports whether tier can be bought with the given interval
// ("month" or "year"; "" means month).
func Offered(tier, interval string) bool {
	if interval == "" {
		interval = "month"
	}
	_, ok := tiers[tier].cents[interval]
	return ok
}

// Session is the part of a Stripe Checkout Session the server reads.
type Session struct {
	ID            string            `json:"id"`
	URL           string            `json:"url"`
	Status        string            `json:"status"`         // open, complete, expired
	PaymentStatus string            `json:"payment_status"` // paid, unpaid, no_payment_required
	Customer      *string           `json:"customer"`
	Subscription  *string           `json:"subscription"`
	Metadata      map[string]string `json:"metadata"`
}

// FamilyID is the family the session was created for, from its metadata.
func (s Session) FamilyID() (uuid.UUID, bool) {
	id, err := uuid.Parse(s.Metadata["family_id"])
	return id, err == nil
}

// Tier is the paid tier from the session metadata, or "" if it is not one.
func (s Session) Tier() string {
	if _, ok := tiers[s.Metadata["tier"]]; ok {
		return s.Metadata["tier"]
	}
	return ""
}

// Paid reports whether Stripe has taken the first payment.
func (s Session) Paid() bool {
	return s.Status == "complete" && s.PaymentStatus == "paid"
}

// ErrNotFound is returned when Stripe has no such checkout session.
var ErrNotFound = errors.New("stripe: no such checkout session")

// CreateCheckout starts a hosted Checkout for a subscription to tier, billed
// every month or every year ("" means month).
// The family id travels in the session and subscription metadata, which is
// how the webhook finds the family.
func CreateCheckout(ctx context.Context, cfg Config, familyID, memberID uuid.UUID, tier, interval string) (Session, error) {
	t, ok := tiers[tier]
	if !ok {
		return Session{}, fmt.Errorf("unknown tier %q", tier)
	}
	if interval == "" {
		interval = "month"
	}
	cents, ok := t.cents[interval]
	if !ok {
		return Session{}, fmt.Errorf("tier %q is not offered per %q", tier, interval)
	}
	form := url.Values{}
	form.Set("mode", "subscription")
	// Built by concatenation: {CHECKOUT_SESSION_ID} must reach Stripe as
	// literal text, which Stripe replaces with the session id on redirect.
	form.Set("success_url", cfg.PublicBaseURL+"/pricing/success?session_id={CHECKOUT_SESSION_ID}")
	form.Set("cancel_url", cfg.PublicBaseURL+"/pricing")
	form.Set("client_reference_id", familyID.String())
	form.Set("metadata[family_id]", familyID.String())
	form.Set("metadata[member_id]", memberID.String())
	form.Set("metadata[tier]", tier)
	form.Set("metadata[interval]", interval)
	form.Set("subscription_data[metadata][family_id]", familyID.String())
	form.Set("subscription_data[metadata][tier]", tier)
	form.Set("subscription_data[metadata][interval]", interval)
	form.Set("line_items[0][quantity]", "1")
	form.Set("line_items[0][price_data][currency]", "usd")
	form.Set("line_items[0][price_data][unit_amount]", strconv.Itoa(cents))
	form.Set("line_items[0][price_data][recurring][interval]", interval)
	form.Set("line_items[0][price_data][product_data][name]", t.name)
	// Managed Payments (on by default for new Stripe accounts) rejects a
	// product without a tax code: txcd_10103000 is software as a service for
	// personal use.
	form.Set("line_items[0][price_data][product_data][tax_code]", "txcd_10103000")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.apiBase()+"/v1/checkout/sessions", strings.NewReader(form.Encode()))
	if err != nil {
		return Session{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return call(cfg, req)
}

// GetCheckout retrieves a checkout session from Stripe.
func GetCheckout(ctx context.Context, cfg Config, sessionID string) (Session, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cfg.apiBase()+"/v1/checkout/sessions/"+url.PathEscape(sessionID), nil)
	if err != nil {
		return Session{}, err
	}
	return call(cfg, req)
}

func call(cfg Config, req *http.Request) (Session, error) {
	req.Header.Set("Authorization", "Bearer "+cfg.SecretKey)
	req.Header.Set("Stripe-Version", StripeVersion)
	res, err := cfg.client().Do(req)
	if err != nil {
		return Session{}, fmt.Errorf("stripe %s %s: %w", req.Method, req.URL.Path, err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return Session{}, err
	}
	if res.StatusCode == http.StatusNotFound {
		return Session{}, ErrNotFound
	}
	if res.StatusCode != http.StatusOK {
		// Stripe's error message never contains the key; it is logged as a
		// 500 and never sent to the client.
		var e struct {
			Error struct{ Type, Code, Message string } `json:"error"`
		}
		_ = json.Unmarshal(body, &e)
		return Session{}, fmt.Errorf("stripe %s %s: %d %s %s: %s", req.Method, req.URL.Path, res.StatusCode, e.Error.Type, e.Error.Code, e.Error.Message)
	}
	var s Session
	if err := json.Unmarshal(body, &s); err != nil {
		return Session{}, fmt.Errorf("stripe %s %s: decode: %w", req.Method, req.URL.Path, err)
	}
	return s, nil
}

// SignatureTolerance is how old a signed webhook may be, as in Stripe's
// own libraries; older ones are rejected to stop replays.
const SignatureTolerance = 5 * time.Minute

// ErrBadSignature covers a missing, malformed, stale or wrong signature.
var ErrBadSignature = errors.New("invalid Stripe-Signature")

// VerifySignature checks a Stripe-Signature header ("t=...,v1=...,...")
// against the raw request body. The signed payload is "<t>.<body>" and the
// signature is its HMAC-SHA256 with the endpoint secret (the whole whsec_...
// string) as key, hex encoded. Any v1 entry may match (several are sent
// while a secret is being rolled); other entries are ignored.
func VerifySignature(body []byte, header, secret string, now time.Time) error {
	var ts int64
	var sigs [][]byte
	for _, part := range strings.Split(header, ",") {
		k, v, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok {
			continue
		}
		switch k {
		case "t":
			n, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				return ErrBadSignature
			}
			ts = n
		case "v1":
			if b, err := hex.DecodeString(v); err == nil {
				sigs = append(sigs, b)
			}
		}
	}
	if ts == 0 || len(sigs) == 0 || secret == "" {
		return ErrBadSignature
	}
	if age := now.Sub(time.Unix(ts, 0)); age > SignatureTolerance || age < -SignatureTolerance {
		return ErrBadSignature
	}
	want := Sign(body, secret, ts)
	for _, s := range sigs {
		if hmac.Equal(s, want) {
			return nil
		}
	}
	return ErrBadSignature
}

// Sign computes the v1 signature Stripe sends for body at timestamp ts.
func Sign(body []byte, secret string, ts int64) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%d.", ts)
	mac.Write(body)
	return mac.Sum(nil)
}

// SignatureHeader builds a Stripe-Signature header, for tests and local tools.
func SignatureHeader(body []byte, secret string, ts int64) string {
	return fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(Sign(body, secret, ts)))
}

// Current returns the family's subscription; ok is false if it has none.
func Current(ctx context.Context, q *store.Queries, familyID uuid.UUID) (sub store.Subscription, ok bool, err error) {
	sub, err = q.GetSubscription(ctx, familyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return sub, false, nil
	}
	return sub, err == nil, err
}

// Tier is the tier both parents get: the subscription's while it is not
// canceled, else free.
func Tier(sub store.Subscription, ok bool) string {
	if !ok || sub.Status == "canceled" {
		return "free"
	}
	return sub.Tier
}

// Activate applies a paid checkout to its family. It is idempotent: the same
// session applied twice (the webhook and the success screen both call it)
// changes the row once. It reports whether anything changed. Unpaid
// sessions, foreign metadata and families that no longer exist are ignored.
func Activate(ctx context.Context, q *store.Queries, s Session, now time.Time) (bool, error) {
	familyID, ok := s.FamilyID()
	if !ok || !s.Paid() || s.Tier() == "" {
		return false, nil
	}
	n, err := q.ActivateSubscription(ctx, store.ActivateSubscriptionParams{
		FamilyID: familyID, Tier: s.Tier(), CheckoutSessionID: s.ID,
		StripeCustomerID: s.Customer, StripeSubscriptionID: s.Subscription, Now: now,
	})
	return n > 0, err
}

// Event is the part of a Stripe event the webhook reads.
type Event struct {
	ID   string
	Type string
	// Object is data.object as raw JSON.
	Object json.RawMessage
}

// HandleEvent applies a verified webhook event once. The event id is
// recorded in the same transaction as its effect, so a failure rolls both
// back and Stripe's retry runs it again, while a redelivery after success
// is a no-op. Event types other than checkout.session.completed and
// customer.subscription.deleted are recorded and ignored.
func HandleEvent(ctx context.Context, pool *pgxpool.Pool, ev Event, now time.Time) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := store.New(tx)
		n, err := q.RecordStripeEvent(ctx, store.RecordStripeEventParams{ID: ev.ID, Type: ev.Type, ReceivedAt: now})
		if err != nil || n == 0 {
			return err
		}
		switch ev.Type {
		case "checkout.session.completed":
			var s Session
			if err := json.Unmarshal(ev.Object, &s); err != nil {
				return nil // not a session we can read; acknowledge so Stripe stops retrying
			}
			_, err := Activate(ctx, q, s, now)
			return err
		case "customer.subscription.deleted":
			var sub struct {
				ID       string            `json:"id"`
				Metadata map[string]string `json:"metadata"`
			}
			if err := json.Unmarshal(ev.Object, &sub); err != nil {
				return nil
			}
			familyID, err := uuid.Parse(sub.Metadata["family_id"])
			if err != nil {
				return nil
			}
			_, err = q.CancelSubscription(ctx, store.CancelSubscriptionParams{
				FamilyID: familyID, StripeSubscriptionID: &sub.ID, Now: now,
			})
			return err
		}
		return nil
	})
}
