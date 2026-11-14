// Features that wait on the backend. Flip a flag when its endpoint is live.

// Enable when PUT plan status lands (/members/{memberId}/plan/{ruleId}/status).
export const BOOKING_ENABLED = false;

// Plus features show a lock while the family is on the free plan. Turn this off
// if the server has no Stripe keys (createCheckoutSession answers 503): then no
// one could unlock them and the demo would lose a feature.
export const PAYWALL_LOCKS = true;
