"use client";

import { useState, useTransition } from "react";
import { Check, CircleCheck } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PaidTier, Tier, UpgradeIntent } from "@/lib/api/types";
import { PLANS, type Plan } from "@/lib/plans";
import { tierIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const HELP_STEPS = 3;
const helpLevel: Record<Tier, number> = { free: 1, plus: 2, concierge: 3 };

// Three plans side by side. The button records intent only (no payment) and the
// card turns into a thank-you. Prices come from lib/plans.ts.
export function PlanCards({ currentTier, requested }: { currentTier?: Tier; requested?: UpgradeIntent }) {
  const [asked, setAsked] = useState<PaidTier | undefined>(requested?.tier);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState<PaidTier>();

  function request(tier: PaidTier) {
    setSending(tier);
    setFailed(false);
    startTransition(async () => {
      const { error } = await api.POST("/family/upgrade-intents", { body: { tier } });
      if (error) setFailed(true);
      else setAsked(tier);
    });
  }

  return (
    <div>
      <ul className="grid items-stretch gap-4 md:grid-cols-3 md:gap-5">
        {PLANS.map((plan) => (
          <li key={plan.tier} className={cn("flex", plan.recommended && "order-first md:order-none")}>
            <PlanCard
              plan={plan}
              isCurrent={(currentTier ?? "free") === plan.tier}
              isAsked={asked === plan.tier}
              busy={pending && sending === plan.tier}
              onRequest={plan.tier === "free" ? undefined : () => request(plan.tier as PaidTier)}
            />
          </li>
        ))}
      </ul>
      <p role="status" className="mt-8 min-h-6 text-center text-label text-muted-foreground">
        {failed
          ? "We could not save that just now. Please try again in a moment."
          : asked
            ? "Thank you. We noted your interest and no payment was taken."
            : "No payment today. Tell us which plan you want and we will be in touch."}
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  isAsked,
  busy,
  onRequest,
}: {
  plan: Plan;
  isCurrent: boolean;
  isAsked: boolean;
  busy: boolean;
  onRequest?: () => void;
}) {
  const Icon = tierIcon[plan.tier];
  const level = helpLevel[plan.tier];
  return (
    <section
      aria-labelledby={`plan-${plan.tier}`}
      className={cn(
        "relative flex w-full flex-col rounded-2xl border bg-card p-6",
        plan.recommended ? "border-2 border-primary shadow-lg shadow-primary/10 md:-my-3 md:py-9" : "border-border",
      )}
    >
      {plan.recommended && (
        <span className="absolute -top-3 left-6 inline-flex h-6 items-center rounded-full bg-primary px-3 text-caption font-medium text-primary-foreground">
          Most families start here
        </span>
      )}

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-full",
            plan.recommended ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id={`plan-${plan.tier}`} className="text-title">
            {plan.name}
          </h2>
          <p className="text-label text-muted-foreground">{plan.tagline}</p>
        </div>
      </div>

      <p className="mt-6 flex items-baseline gap-1">
        <span className="font-mono text-display tabular-nums">${plan.price}</span>
        <span className="text-label text-muted-foreground">{plan.price === 0 ? "forever" : "per month"}</span>
      </p>

      <div className="mt-4 flex items-center gap-1.5" role="img" aria-label={`Level of help: ${level} of ${HELP_STEPS}`}>
        {Array.from({ length: HELP_STEPS }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < level ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-body">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-status-ok-soft text-status-ok">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {isAsked ? (
          <p className="flex h-11 items-center justify-center gap-2 rounded-lg bg-status-ok-soft text-label font-semibold text-status-ok">
            <CircleCheck className="size-4.5" aria-hidden />
            Requested
          </p>
        ) : isCurrent && !onRequest ? (
          <p className="flex h-11 items-center justify-center rounded-lg bg-muted text-label font-semibold text-muted-foreground">Your plan</p>
        ) : onRequest ? (
          <Button
            type="button"
            size="lg"
            variant={plan.recommended ? "default" : "outline"}
            disabled={busy}
            onClick={onRequest}
            className="h-11 w-full text-label"
          >
            {busy ? "Sending..." : `Choose ${plan.name}`}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
