"use client";

import { useState } from "react";
import { Hospital, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { BirthCostPlan, BirthCostScenario } from "@/lib/api/types";
import { dollars, toCents, toDollarsField } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";
import { CountUp } from "./motion";

const field = "h-11 w-full min-w-0 rounded-xl border border-line-2 bg-card pl-6 pr-3 font-mono text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-label";

// A typical plan to start from, so the form is never blank. These are not from the family's insurer.
const typical = { deductible: "3000", max: "8000", coins: "20", paid: "0" };

/**
 * Birth cost estimate for a US plan. Always labelled as an estimate: the badge
 * and the note sit above the numbers, not in a footnote.
 */
export function BirthCostCard({ memberId, initial }: { memberId: string; initial: BirthCostPlan }) {
  const [plan, setPlan] = useState(initial);
  const [editing, setEditing] = useState(!initial.input);
  const [v, setV] = useState(
    initial.input
      ? { deductible: toDollarsField(initial.input.deductibleCents), max: toDollarsField(initial.input.outOfPocketMaxCents), coins: String(initial.input.coinsurancePercent), paid: toDollarsField(initial.input.alreadyPaidCents) }
      : typical,
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await api.PUT("/members/{memberId}/birth-cost-plan", {
      params: { path: { memberId } },
      body: {
        deductibleCents: toCents(v.deductible),
        outOfPocketMaxCents: toCents(v.max),
        coinsurancePercent: Math.min(100, Math.max(0, Math.round(Number(v.coins) || 0))),
        alreadyPaidCents: toCents(v.paid),
      },
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not save your plan. Please try again.");
      return;
    }
    setPlan(data);
    setEditing(false);
  }

  const max = plan.input?.outOfPocketMaxCents ?? 0;
  const scale = Math.max(1, max, ...plan.scenarios.map((s) => s.total.highCents));

  return (
    <SoftCard as="section" aria-labelledby="birth-title" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-ink-2">
            <Hospital aria-hidden className="size-4.5" />
          </span>
          <h2 id="birth-title" className="text-title">
            What a birth may cost us
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-butter px-3 py-1 font-mono text-caption font-semibold tracking-widest text-ink uppercase">Estimate</span>
      </div>

      <p role="note" className="flex gap-2 rounded-2xl bg-sun px-4 py-3 text-label text-ink-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {plan.estimateNote}
      </p>

      {plan.scenarios.length > 0 && !editing && (
        <ul className="flex flex-col gap-5">
          {plan.scenarios.map((s) => (
            <Scenario key={s.kind} s={s} scale={scale} max={max} />
          ))}
        </ul>
      )}

      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-muted p-3">
          <p className="text-label text-ink-2">Your plan&apos;s numbers are on your insurance card or in the plan summary. We start from a typical plan.</p>
          <div className="grid grid-cols-2 gap-3">
            <Money label="Deductible" value={v.deductible} onChange={(x) => setV({ ...v, deductible: x })} />
            <Money label="Out-of-pocket maximum" value={v.max} onChange={(x) => setV({ ...v, max: x })} />
            <label className="block text-label text-ink-2">
              You pay after the deductible
              <span className="relative mt-1 block">
                <input inputMode="numeric" value={v.coins} onChange={(e) => setV({ ...v, coins: e.target.value })} className={cn(field, "pl-3")} />
                <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </span>
            </label>
            <Money label="Already spent this plan year" value={v.paid} onChange={(x) => setV({ ...v, paid: x })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="press min-h-11 rounded-full bg-primary px-5 text-label font-medium text-primary-foreground disabled:opacity-50 md:min-h-9">
              Show my estimate
            </button>
            {plan.input && (
              <button type="button" onClick={() => setEditing(false)} className="press min-h-11 rounded-full px-4 text-label text-muted-foreground md:min-h-9">
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="press self-start rounded-full border border-line-2 px-4 py-2 text-label text-ink-2 hover:bg-muted">
          Change plan numbers
        </button>
      )}

      {plan.referenceOutOfPocket && (
        <p className="text-label text-ink-2">
          For comparison, people with employer coverage paid on average{" "}
          <span className="font-mono">{dollars(plan.referenceOutOfPocket.vaginalCents)}</span> out of pocket for a vaginal birth,{" "}
          <span className="font-mono">{dollars(plan.referenceOutOfPocket.cesareanCents)}</span> for a cesarean and{" "}
          <span className="font-mono">{dollars(plan.referenceOutOfPocket.newbornCents)}</span> for the newborn.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Fold title="Bills you will probably see">
          <ul className="list-disc pl-5">
            {plan.billingLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Fold>
        <Fold title="Ask your insurer and hospital">
          <ul className="list-disc pl-5">
            {plan.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Fold>
        <Fold title="Adding the baby to your coverage">
          <p>{plan.enrollment.summary}</p>
        </Fold>
      </div>
      <p className="text-caption text-muted-foreground">
        The range is our own: 70 to 130 percent of the average total in the first source, run through your plan. Your bill can fall outside it.
      </p>
    </SoftCard>
  );
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-label text-ink-2">
      {label}
      <span className="relative mt-1 block">
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className={field} />
      </span>
    </label>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-muted px-4 py-3 text-label text-ink-2">
      <summary className="cursor-pointer list-none text-label font-medium text-ink marker:hidden">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

const kindLabel = { vaginal: "Vaginal birth", cesarean: "Cesarean birth" } as const;

/** One scenario: the range as a bar on a shared 0 to maximum scale, the figure counted up. */
function Scenario({ s, scale, max }: { s: BirthCostScenario; scale: number; max: number }) {
  const left = (s.total.lowCents / scale) * 100;
  const width = Math.max(1.5, ((s.total.highCents - s.total.lowCents) / scale) * 100);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body">{kindLabel[s.kind]}</span>
        <span className="font-mono text-body">
          <CountUp value={s.total.lowCents} format={dollars} /> to <CountUp value={s.total.highCents} format={dollars} />
        </span>
      </div>
      <div className="relative mt-2 h-3 rounded-full bg-muted" role="img" aria-label={`${kindLabel[s.kind]}: ${dollars(s.total.lowCents)} to ${dollars(s.total.highCents)} of your own money, out of pocket maximum ${dollars(max)}`}>
        <span className="absolute inset-y-0 rounded-full bg-primary/85 origin-left animate-[money-grow_500ms_var(--ease-out)_both] motion-reduce:animate-none" style={{ left: `${left}%`, width: `${width}%` }} />
        {max > 0 && <span aria-hidden className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink/70" style={{ left: `${Math.min(99.5, (max / scale) * 100)}%` }} />}
      </div>
      <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 font-mono text-caption text-muted-foreground">
        <span>
          birth {dollars(s.birth.lowCents)} to {dollars(s.birth.highCents)} · {s.newborn.highCents < s.newborn.lowCents ? "newborn included in your maximum" : `newborn ${dollars(s.newborn.lowCents)} to ${dollars(s.newborn.highCents)}`}
        </span>
        <span>{s.hitsMaximum ? "capped at your maximum" : `max ${dollars(max)}`}</span>
      </p>
    </li>
  );
}
