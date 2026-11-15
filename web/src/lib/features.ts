// Features that wait on the backend. Flip a flag when its endpoint is live.

// Plus features show a lock while the family is on the free plan. Turn this off
// if the server has no Stripe keys (createCheckoutSession answers 503): then no
// one could unlock them and the demo would lose a feature.
export const PAYWALL_LOCKS = false;

// Pregnancy loss support (createPregnancyLoss). A write cannot be probed without
// recording or undoing a loss, so the entry waits on this flag. Turn it on when
// the backend lands, or set NEXT_PUBLIC_PREGNANCY_LOSS=1 to try it against a
// stand-in API. Screens follow Family.pregnancyLoss whatever this says.
export const PREGNANCY_LOSS_ENABLED = process.env.NEXT_PUBLIC_PREGNANCY_LOSS === "1";
