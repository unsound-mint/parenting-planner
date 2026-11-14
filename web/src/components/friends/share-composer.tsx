"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CalendarHeart, Lock, PenLine, Sparkles, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import type { FriendUpdate, FriendUpdateKind, Stage } from "@/lib/api/types";
import { SoftCard } from "@/components/joy/soft-card";
import { tap } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

export const KINDS: { kind: FriendUpdateKind; label: string; icon: LucideIcon }[] = [
  { kind: "moment", label: "A moment", icon: Sparkles },
  { kind: "week", label: "Our week", icon: CalendarHeart },
  { kind: "note", label: "A note", icon: PenLine },
];

// Starter lines by stage, so the composer invites a first share. They are
// suggestions the parent edits; nothing is posted without them pressing Share.
const STARTERS: Record<"pregnant" | "baby" | "child" | "getting", Record<FriendUpdateKind, string[]>> = {
  getting: {
    moment: ["We said it out loud: we are ready to try."],
    week: ["This week we started folic acid and long evening walks."],
    note: ["Any tips for the first appointment?"],
  },
  pregnant: {
    moment: ["First kick we both felt!", "Heard the heartbeat today."],
    week: ["Kicks every evening after dinner this week.", "We set up the crib this week."],
    note: ["Craving pickles at midnight, as promised.", "Any hospital bag tips?"],
  },
  baby: {
    moment: ["First real smile today.", "Rolled over for the first time!"],
    week: ["This week we found a nap routine that works.", "Our first walk to the park."],
    note: ["Slept four hours in a row. We celebrated with coffee."],
  },
  child: {
    moment: ["New word today:", "First time on the big slide."],
    week: ["This week we tried painting with fingers.", "Our first full week of preschool."],
    note: ["Bedtime took ten minutes. A record."],
  },
};

const group = (stage: Stage) =>
  stage === "pregnancy" ? "pregnant" : stage === "postpartum" || stage === "infant" ? "baby" : stage === "planning" || stage === "trying" ? "getting" : "child";

/**
 * Share one thing with friend families. It is a copy of what you write, never
 * a link to your journal or records. The Share button says how many families
 * will see it; with none yet, it still saves so they see it once connected.
 */
export function ShareComposer({ memberId, stage, reach, onShared }: { memberId: string; stage: Stage; reach: number; onShared: (u: FriendUpdate) => void }) {
  const [kind, setKind] = useState<FriendUpdateKind>("moment");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const starters = STARTERS[group(stage)][kind];

  const share = (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    start(async () => {
      const { data } = await api.POST("/members/{memberId}/friend-updates", { params: { path: { memberId } }, body: { kind, body: text } });
      if (!data) return void toast.error("That did not share. Try again in a moment.");
      setBody("");
      onShared(data);
    });
  };

  return (
    <SoftCard tone="me" as="section" aria-labelledby="share-title">
      <form onSubmit={share} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="share-title" className="text-title">
            Share something with friends
          </h2>
          <div role="radiogroup" aria-label="What you share" className="flex flex-wrap gap-1.5">
            {KINDS.map(({ kind: k, label, icon: Icon }) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "press inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-label transition-colors duration-(--duration-fast)",
                  kind === k ? "bg-me text-white" : "bg-card/80 text-ink-2 hover:bg-card",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
        <label htmlFor="share-body" className="sr-only">
          What you share
        </label>
        <textarea
          id="share-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder={kind === "week" ? "What made this week ours? We add where you are (week or age)." : "A line or two your friends will smile at"}
          className="w-full resize-none rounded-2xl border border-line-2 bg-card px-4 py-3 text-body outline-none placeholder:text-muted-foreground focus-visible:border-me focus-visible:ring-3 focus-visible:ring-me/20"
        />
        {!body && (
          <div className="flex flex-wrap gap-2" aria-label="Ideas">
            {starters.map((s) => (
              <motion.button
                key={s}
                type="button"
                whileTap={tap}
                onClick={() => setBody(s.endsWith(":") ? s + " " : s)}
                className="min-h-9 rounded-full bg-card/70 px-3 text-left text-label font-normal text-ink-2 hover:bg-card"
              >
                {s}
              </motion.button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-caption text-ink-2">
            <Lock className="size-3.5" aria-hidden />
            {reach === 0 ? "Only friend families you connect with will see it." : `Only your ${reach === 1 ? "friend family" : `${reach} friend families`} will see it.`}
          </p>
          <button type="submit" disabled={!body.trim() || pending} className="press min-h-11 rounded-full bg-me px-5 text-label font-semibold text-white disabled:opacity-50">
            {pending ? "Sharing" : "Share"}
          </button>
        </div>
      </form>
    </SoftCard>
  );
}
