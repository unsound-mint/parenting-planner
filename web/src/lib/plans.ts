import type { Tier } from "@/lib/api/types";

export type Plan = {
  tier: Tier;
  name: string;
  /** US dollars per month; yearlyPrice is dollars per year (absent for Free). */
  price: number;
  yearlyPrice?: number;
  tagline: string;
  features: string[];
  /** Shown first and emphasized. */
  recommended?: boolean;
};

// The owner set these prices on 2026-11-15: Plus is $14.99 a month or $119.99
// a year. The API holds the same amounts in cents (api/internal/billing).
// Change them here only; nothing else on the pricing page hardcodes a price.
export const PLANS: Plan[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    tagline: "Know where you are",
    features: ["Stage guide", "Health passport for you, your partner and your child", "Crisis and help contacts"],
  },
  {
    tier: "plus",
    name: "Plus",
    price: 14.99,
    yearlyPrice: 119.99,
    tagline: "A plan built for each of you",
    recommended: true,
    features: [
      "Everything in Free",
      "Weekly plan for both parents",
      "Full health data hub",
      "Patterns from your check-ins",
      "Shared plan and shift handoffs",
    ],
  },
];

export type Interval = "month" | "year";

/** Percent saved by paying yearly instead of twelve months, rounded. */
export function yearlySavingPercent(plan: Plan): number {
  if (!plan.yearlyPrice) return 0;
  return Math.round((1 - plan.yearlyPrice / (plan.price * 12)) * 100);
}

/** "$14.99", with cents. */
export function formatPrice(amount: number): string {
  return amount === 0 ? "$0" : `$${amount.toFixed(2)}`;
}
