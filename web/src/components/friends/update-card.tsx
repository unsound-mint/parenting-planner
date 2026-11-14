"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { HandHeart, Heart, Sparkle, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import type { FriendReactionKind, FriendUpdate } from "@/lib/api/types";
import { spring, tap } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { KINDS } from "./share-composer";
import { familyName } from "./friend-list";

const REACTIONS: { kind: FriendReactionKind; label: string; sent: string; icon: LucideIcon }[] = [
  { kind: "heart", label: "Love this", sent: "loves this", icon: Heart },
  { kind: "hug", label: "Send a hug", sent: "sent a hug", icon: HandHeart },
  { kind: "got_this", label: "You've got this", sent: "says you've got this", icon: Sparkle },
];

const when = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * One shared update. On a friend's update the family reacts with a preset (no
 * comments, no counts); on its own update it sees who sent what, and the author
 * can stop sharing it.
 */
export function UpdateCard({ memberId, myName, update: u, onRemoved }: { memberId: string; myName: string; update: FriendUpdate; onRemoved: () => void }) {
  const [mine, setMine] = useState<FriendReactionKind | undefined>(u.myReaction);
  const [pending, start] = useTransition();
  const kind = KINDS.find((k) => k.kind === u.kind) ?? KINDS[2];
  const path = { params: { path: { memberId, updateId: u.id } } };
  // On a friend's update, the others listed are this family's other parent.
  const others = u.reactions.filter((r) => r.name !== myName);

  const react = (k: FriendReactionKind) => {
    const next = mine === k ? undefined : k;
    const before = mine;
    setMine(next);
    start(async () => {
      const { response } = next
        ? await api.PUT("/members/{memberId}/friend-updates/{updateId}/reaction", { ...path, body: { reaction: next } })
        : await api.DELETE("/members/{memberId}/friend-updates/{updateId}/reaction", path);
      if (!response.ok) {
        setMine(before);
        toast.error("That did not send. Try again.");
      }
    });
  };

  const unshare = () =>
    start(async () => {
      const { response } = await api.DELETE("/members/{memberId}/friend-updates/{updateId}", path);
      if (response.ok) onRemoved();
      else toast.error("Could not remove it. Try again.");
    });

  return (
    <article className={cn("flex min-w-0 flex-col gap-3 rounded-3xl border p-5", u.mine ? "border-me-mid/40 bg-me-soft/40" : "border-line bg-card")}>
      <header className="flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", u.mine ? "bg-me-soft text-me" : "bg-them-soft text-them")}>
          <kind.icon className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label text-ink">{u.mine ? (u.authoredByMe ? "You shared" : `${u.authorName} shared`) : `${u.authorName}, ${familyName(u.familyNames)}`}</span>
          <span className="font-mono text-caption text-muted-foreground">
            {kind.label} · {when(u.createdAt)}
          </span>
        </span>
      </header>
      <div className="min-w-0">
        {u.headline && <p className="font-mono text-caption text-me">{u.headline}</p>}
        <p className="text-body text-pretty text-ink">{u.body}</p>
      </div>

      {u.mine ? (
        <footer className="flex flex-wrap items-center gap-2">
          {u.reactions.map((r, n) => {
            const R = REACTIONS.find((x) => x.kind === r.reaction) ?? REACTIONS[0];
            return (
              <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-caption text-ink-2">
                <R.icon className="size-3.5 text-me" aria-hidden />
                {r.name} {R.sent}
              </span>
            );
          })}
          {u.reactions.length === 0 && <span className="text-caption text-muted-foreground">Friends can send a heart or a hug back.</span>}
          {u.authoredByMe && (
            <button type="button" onClick={unshare} disabled={pending} className="press ml-auto min-h-9 rounded-full px-3 text-caption text-muted-foreground hover:bg-card hover:text-ink">
              Stop sharing
            </button>
          )}
        </footer>
      ) : (
        <footer className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="React">
            {REACTIONS.map((r) => {
              const on = mine === r.kind;
              return (
                <motion.button
                  key={r.kind}
                  type="button"
                  whileTap={tap}
                  aria-pressed={on}
                  onClick={() => react(r.kind)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-label transition-colors duration-(--duration-fast)",
                    on ? "bg-me text-white" : "bg-muted text-ink-2 hover:bg-me-soft hover:text-me",
                  )}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={on ? "on" : "off"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={on ? spring.playful : spring.ui} className="grid">
                      <r.icon className={cn("size-4", on && "fill-current")} aria-hidden />
                    </motion.span>
                  </AnimatePresence>
                  {r.label}
                </motion.button>
              );
            })}
          </div>
          {others.length > 0 && (
            <p className="text-caption text-muted-foreground">
              {others.map((r) => `${r.name} ${(REACTIONS.find((x) => x.kind === r.reaction) ?? REACTIONS[0]).sent}`).join(", ")}
            </p>
          )}
        </footer>
      )}
    </article>
  );
}
