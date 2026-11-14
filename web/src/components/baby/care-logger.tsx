"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock } from "lucide-react";
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

export function QuickAdd({ memberId, childId, actions }: { memberId: string; childId: string; actions: QuickAction[] }) {
  const router = useRouter();
  const { minutes: ago } = useContext(WhenContext);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function log(action: QuickAction) {
    // Stamp the time at the tap, not when the screen was drawn.
    const at = stamp(ago);
    const body: CareLogEntryInput = { kind: action.kind, childId, startedAt: new Date(at).toISOString() };
    if (action.kind === "feed") body.feedMethod = action.feedMethod;
    if (action.kind === "diaper") body.diaper = action.diaper;
    // The API has no call to end a sleep, so a sleep is logged finished: it ends at the chosen time.
    if (action.kind === "sleep") {
      body.startedAt = new Date(at - action.minutes * 60_000).toISOString();
      body.endedAt = new Date(at).toISOString();
    }
    setBusy(action.label);
    startTransition(async () => {
      const { error, response } = await api.POST("/members/{memberId}/care-log", {
        params: { path: { memberId } },
        body,
      });
      setBusy(null);
      if (error) {
        toast.error(response.status === 403 ? "You may not log for the baby." : (error.message ?? "Could not save. Please try again."));
        return;
      }
      toast.success(`${careLogLabel[action.kind]} logged`);
      router.refresh();
    });
  }

  return (
    <div className={cn("grid gap-2", actions.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          disabled={pending}
          aria-busy={busy === a.label}
          onClick={() => log(a)}
          className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-2 text-label font-medium transition-[background-color,transform] duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-60"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
