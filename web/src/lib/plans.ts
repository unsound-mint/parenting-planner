import type { Tier } from "@/lib/api/types";

export type Plan = {
  tier: Tier;
  name: string;
  /** US dollars per month. */
  price: number;
  tagline: string;
  features: string[];
  /** Shown first and emphasized. */
  recommended?: boolean;
};

// PROPOSAL, not final: tiers and prices follow docs/product.md ("How it makes
// money"). Dayana decides the final numbers and contents (#180). Change them
// here only; nothing else on the pricing page hardcodes a price.
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
    price: 29,
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
  {
    tier: "concierge",
    name: "Concierge",
    price: 99,
    tagline: "A person on your side",
    features: ["Everything in Plus", "A human care navigator", "One psychologist session a month"],
  },
];
