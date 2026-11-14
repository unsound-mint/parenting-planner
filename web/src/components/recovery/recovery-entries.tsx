"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "motion/react";
import { HeartHandshake, Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { RecoveryCheckin } from "@/lib/api/types";
import { bleedingLabel, breastLabel, pelvicLabel, woundLabel } from "@/lib/recovery";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";
import { MoodFace, type Mood } from "@/components/joy/mood-face";
import { duration, ease, stagger } from "@/components/joy/motion";
import { UrgentCallout } from "./recovery-composer";

const day = (iso: string) => formatShortDate(iso.slice(0, 10));

/** Pain over the last check-ins, oldest on the left. Bars grow from the bottom (transform only). */
export function PainTrend({ items }: { items: RecoveryCheckin[] }) {
  const recent = items.slice(0, 10).reverse();
  if (recent.length < 2) return null;
  return (
    <SoftCard as="section" aria-label="Pain over time" tone="leaf" className="flex flex-col gap-3">
      <h2 className="text-title">Pain is {recent.at(-1)!.pain < recent[0].pain ? "easing" : "holding steady"}</h2>
      <div className="flex h-24 items-end gap-2" role="img" aria-label={`Pain, oldest to newest: ${recent.map((r) => r.pain).join(", ")} of 10`}>
        {recent.map((r, i) => (
          <div key={r.id} className="flex h-full flex-1 flex-col justify-end gap-1">
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: duration.enter, ease: ease.out, delay: i * stagger }}
              style={{ height: `${Math.max(8, r.pain * 10)}%`, transformOrigin: "bottom" }}
              className="rounded-t-lg bg-me-mid"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-caption text-muted-foreground">
        <span>{day(recent[0].recordedAt)}</span>
        <span>{day(recent.at(-1)!.recordedAt)}</span>
      </div>
    </SoftCard>
  );
}

export function RecoveryEntries({ memberId, items, partnerName, authorNames }: { memberId: string; items: RecoveryCheckin[]; partnerName?: string; authorNames: Record<string, string> }) {
  return (
    <section aria-label="Check-ins" className="flex min-w-0 flex-col gap-3">
      <h2 className="font-mono text-caption tracking-[0.07em] text-muted-foreground uppercase">Check-ins</h2>
      <ul className="flex flex-col gap-3">
        {items.map((e) => (
          <li key={e.id}>
            <Entry memberId={memberId} entry={e} partnerName={partnerName} own={e.authorId === memberId} author={authorNames[e.authorId] ?? "Her"} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Entry({ memberId, entry, partnerName, own, author }: { memberId: string; entry: RecoveryCheckin; partnerName?: string; own: boolean; author: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shared, setShared] = useState(entry.visibility !== "private");

  function toggle() {
    const next = !shared;
    setShared(next);
    startTransition(async () => {
      const { error } = await api.PATCH("/members/{memberId}/recovery-checkins/{checkinId}", {
        params: { path: { memberId, checkinId: entry.id } },
        body: { visibility: next ? "partner" : "private" },
      });
      if (error) {
        setShared(!next);
        toast.error(error.message ?? "Could not change who sees this.");
        return;
      }
      toast.success(next ? `Shared with ${partnerName ?? "your partner"}` : "Only you can see it now");
      router.refresh();
    });
  }

  const facts = [
    `Bleeding: ${bleedingLabel[entry.bleeding].toLowerCase()}`,
    entry.wound !== "not_applicable" ? `Stitches or scar: ${woundLabel[entry.wound].toLowerCase()}` : null,
    entry.breasts !== "not_applicable" ? `Breasts: ${breastLabel[entry.breasts].toLowerCase()}` : null,
    `Pelvic floor: ${pelvicLabel[entry.pelvicFloor].toLowerCase()}`,
    `${entry.sleepHours} h sleep`,
  ].filter(Boolean) as string[];

  return (
    <SoftCard as="article" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {entry.mood && <MoodFace mood={entry.mood as Mood} className="size-10" title={`Mood ${entry.mood} of 5`} />}
        <div className="min-w-0 flex-1">
          <p className="text-title">{day(entry.recordedAt)}</p>
          <p className="font-mono text-caption text-muted-foreground">
            {own ? "You" : author} · pain {entry.pain}/10
          </p>
        </div>
        {own ? (
          <button
            type="button"
            onClick={toggle}
            disabled={pending || !partnerName}
            aria-pressed={shared}
            className={cn(
              "press inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-caption outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              shared ? "border-them bg-them-soft text-them" : "border-line text-muted-foreground hover:bg-muted",
            )}
          >
            {shared ? <HeartHandshake aria-hidden className="size-3.5" /> : <Lock aria-hidden className="size-3.5" />}
            {shared ? `Shared with ${partnerName}` : "Only you"}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-caption text-them">
            <HeartHandshake aria-hidden className="size-3.5" />
            Shared with you
          </span>
        )}
      </div>
      <p className="text-label text-ink-2">{facts.join(" · ")}</p>
      {entry.note && <p className="rounded-2xl bg-muted px-3 py-2 text-label">{entry.note}</p>}
      {entry.urgent && own && <UrgentCallout memberId={memberId} />}
    </SoftCard>
  );
}
