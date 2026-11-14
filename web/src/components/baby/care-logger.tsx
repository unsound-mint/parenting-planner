"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Clock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { CareLogEntryInput, DiaperContent, FeedMethod } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { careLogLabel } from "@/lib/visuals";

// One tap logs an entry. The time is "now" unless the person moved the "When"
// chip once for the whole screen (the baby was fed a while ago and nobody wrote it down).
const OFFSETS = [
  { minutes: 0, label: "Now" },
  { minutes: 15, label: "15 min ago" },
  { minutes: 30, label: "30 min ago" },
  { minutes: 60, label: "1 h ago" },
] as const;

const WhenContext = createContext<{ minutes: number; set: (m: number) => void }>({ minutes: 0, set: () => {} });

export function WhenProvider({ children }: { children: React.ReactNode }) {
  const [minutes, set] = useState(0);
  return <WhenContext.Provider value={{ minutes, set }}>{children}</WhenContext.Provider>;
}

export function WhenPicker() {
  const { minutes, set } = useContext(WhenContext);
  return (
    <div role="radiogroup" aria-label="When it happened" className="flex items-center gap-2">
      <Clock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {OFFSETS.map((o) => (
          <button
            key={o.minutes}
            type="button"
            role="radio"
            aria-checked={minutes === o.minutes}
            onClick={() => set(o.minutes)}
            className={cn(
              "min-h-9 flex-1 rounded-lg px-2.5 text-label whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              minutes === o.minutes ? "bg-card font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Outside the component: reading the clock is for the tap handler only, never for rendering.
function stamp(minutesAgo: number): number {
  return Date.now() - minutesAgo * 60_000;
}

export type QuickAction =
  | { kind: "feed"; label: string; feedMethod: FeedMethod }
  | { kind: "sleep"; label: string; minutes: number }
  | { kind: "diaper"; label: string; diaper: DiaperContent };

/** Posts one entry and refreshes the screen; the toast offers to undo it. */
function useLogEntry(memberId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function save(key: string, body: CareLogEntryInput, done?: () => void) {
    setBusy(key);
    startTransition(async () => {
      const { data, error, response } = await api.POST("/members/{memberId}/care-log", { params: { path: { memberId } }, body });
      setBusy(null);
      if (error) {
        toast.error(response.status === 403 ? "You may not log for the baby." : (error.message ?? "Could not save. Please try again."));
        return;
      }
      done?.();
      toast.success(`${careLogLabel[body.kind]} logged`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await api.DELETE("/members/{memberId}/care-log/{entryId}", { params: { path: { memberId, entryId: data.id } } });
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  }
  return { save, pending, busy };
}

const chip =
  "press flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 text-label font-medium transition-[background-color,border-color] duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

export function QuickAdd({ memberId, childId, actions }: { memberId: string; childId: string; actions: QuickAction[] }) {
  const { minutes: ago } = useContext(WhenContext);
  const { save, pending, busy } = useLogEntry(memberId);

  function log(action: QuickAction) {
    // Stamp the time at the tap, not when the screen was drawn.
    const at = stamp(ago);
    const body: CareLogEntryInput = { kind: action.kind, childId, startedAt: new Date(at).toISOString() };
    if (action.kind === "feed") body.feedMethod = action.feedMethod;
    if (action.kind === "diaper") body.diaper = action.diaper;
    // A quick sleep is logged finished: it ends at the chosen time. A longer or open one is set in the day chart.
    if (action.kind === "sleep") {
      body.startedAt = new Date(at - action.minutes * 60_000).toISOString();
      body.endedAt = new Date(at).toISOString();
    }
    save(action.label, body);
  }

  return (
    <div className={cn("grid gap-2", actions.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
      {actions.map((a) => (
        <button key={a.label} type="button" disabled={pending} aria-busy={busy === a.label} onClick={() => log(a)} className={chip}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

const SIDES: { side: "left" | "right" | "both"; label: string; method: FeedMethod }[] = [
  { side: "left", label: "Left", method: "breast_left" },
  { side: "right", label: "Right", method: "breast_right" },
  { side: "both", label: "Both", method: "breast_both" },
];
const AMOUNTS = [60, 90, 120, 150];

/**
 * A feed in two taps: Breast then the side, or Bottle then the amount (the milk
 * is a toggle that remembers the last bottle). The side to start on is the one
 * not used last time, so it is marked. Length and notes are added by editing
 * the feed in the day chart.
 */
export function FeedLogger({ memberId, childId, nextSide, lastBottle }: { memberId: string; childId: string; nextSide?: "left" | "right"; lastBottle?: FeedMethod }) {
  const { minutes: ago } = useContext(WhenContext);
  const { save, pending, busy } = useLogEntry(memberId);
  const [step, setStep] = useState<"pick" | "breast" | "bottle">("pick");
  const [milk, setMilk] = useState<FeedMethod>(lastBottle === "bottle_formula" ? "bottle_formula" : "bottle_breast_milk");

  function log(key: string, method: FeedMethod, amountMl?: number) {
    const body: CareLogEntryInput = { kind: "feed", childId, startedAt: new Date(stamp(ago)).toISOString(), feedMethod: method };
    if (amountMl) body.amountMl = amountMl;
    save(key, body, () => setStep("pick"));
  }

  const back = (
    <button type="button" onClick={() => setStep("pick")} aria-label="Back" className={cn(chip, "w-11 shrink-0 px-0 text-muted-foreground")}>
      <ArrowLeft aria-hidden className="size-4" />
    </button>
  );

  if (step === "breast") {
    return (
      <div className="flex gap-2" role="group" aria-label="Which side">
        {back}
        <div className="grid flex-1 grid-cols-3 gap-2">
          {SIDES.map((s) => (
            <button
              key={s.side}
              type="button"
              disabled={pending}
              aria-busy={busy === s.side}
              onClick={() => log(s.side, s.method)}
              className={cn(chip, nextSide === s.side && "border-status-up bg-status-up-soft text-status-up hover:bg-status-up-soft")}
            >
              {s.label}
              {nextSide === s.side && <span className="sr-only"> (start here: the other side was last)</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (step === "bottle") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {back}
          <div role="radiogroup" aria-label="Milk" className="flex flex-1 gap-1 rounded-xl bg-muted p-1">
            {(["bottle_breast_milk", "bottle_formula"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={milk === m}
                onClick={() => setMilk(m)}
                className={cn(
                  "min-h-9 flex-1 rounded-lg px-2 text-label whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  milk === m ? "bg-card font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "bottle_formula" ? "Formula" : "Breast milk"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Amount">
          {AMOUNTS.map((a) => (
            <button key={a} type="button" disabled={pending} aria-busy={busy === String(a)} onClick={() => log(String(a), milk, a)} className={cn(chip, "font-mono")}>
              {a}
              <span className="text-caption text-muted-foreground">ml</span>
            </button>
          ))}
          <button type="button" disabled={pending} aria-busy={busy === "bottle"} onClick={() => log("bottle", milk)} className={cn(chip, "text-muted-foreground")}>
            Not sure
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setStep("breast")} className={chip}>
        Breast
        {nextSide && <span className="text-caption font-normal text-muted-foreground">· {nextSide} next</span>}
      </button>
      <button type="button" onClick={() => setStep("bottle")} className={chip}>
        Bottle
      </button>
    </div>
  );
}

/**
 * Sleep: "Asleep now" starts a sleep that runs until "Woke up"; the chips log
 * a nap that already happened and ended at the chosen time.
 */
export function SleepLogger({ memberId, childId, open }: { memberId: string; childId: string; open?: { id: string; startedAt: string } }) {
  const router = useRouter();
  const { minutes: ago } = useContext(WhenContext);
  const { save, pending, busy } = useLogEntry(memberId);
  const [waking, startWaking] = useTransition();

  if (open) {
    return (
      <button
        type="button"
        disabled={waking}
        onClick={() =>
          startWaking(async () => {
            const { error } = await api.PATCH("/members/{memberId}/care-log/{entryId}", {
              params: { path: { memberId, entryId: open.id } },
              body: { kind: "sleep", childId, startedAt: open.startedAt, endedAt: new Date(Math.max(stamp(ago), Date.parse(open.startedAt))).toISOString() },
            });
            if (error) {
              toast.error(error.message ?? "Could not save. Please try again.");
              return;
            }
            toast.success("Sleep ended");
            router.refresh();
          })
        }
        className={cn(chip, "w-full")}
      >
        Woke up
      </button>
    );
  }
  const at = () => stamp(ago);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        type="button"
        disabled={pending}
        aria-busy={busy === "now"}
        onClick={() => save("now", { kind: "sleep", childId, startedAt: new Date(at()).toISOString() })}
        className={cn(chip, "border-primary/40 bg-secondary text-secondary-foreground hover:bg-secondary")}
      >
        Fell asleep
      </button>
      {[30, 60, 120].map((m) => (
        <button
          key={m}
          type="button"
          disabled={pending}
          aria-busy={busy === String(m)}
          onClick={() => save(String(m), { kind: "sleep", childId, startedAt: new Date(at() - m * 60_000).toISOString(), endedAt: new Date(at()).toISOString() })}
          className={chip}
        >
          {m < 60 ? `${m} min nap` : `${m / 60} h nap`}
        </button>
      ))}
    </div>
  );
}
