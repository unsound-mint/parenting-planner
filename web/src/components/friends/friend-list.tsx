"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Hourglass, Lock, UsersRound } from "lucide-react";
import { api } from "@/lib/api/client";
import type { FriendFamily } from "@/lib/api/types";
import { SoftCard } from "@/components/joy/soft-card";
import { spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

const TINTS = ["bg-them-soft text-them", "bg-leaf-soft text-leaf", "bg-me-soft text-me", "bg-butter text-ink-2"];

export const familyName = (names: string[]) => (names.length === 0 ? "A family" : names.join(" and "));

/** The friend families as overlapping initials, for the hero. */
export function FamilyFaces({ families }: { families: FriendFamily[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-3" aria-label="Friend families">
      {families.map((f, n) => (
        <li key={f.connectionId} className="flex items-center gap-2 rounded-full bg-card/80 py-1 pr-3.5 pl-1">
          <span className="flex -space-x-2" aria-hidden>
            {f.names.map((name, k) => (
              <span key={k} className={cn("grid size-8 place-items-center rounded-full text-label font-semibold ring-2 ring-card", TINTS[(n * 2 + k) % TINTS.length])}>
                {name.slice(0, 1)}
              </span>
            ))}
          </span>
          <span className="text-label text-ink">{familyName(f.names)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Friend families with their state: accept or decline a request, cancel your
 * own, disconnect (asked twice). Below, the fixed list of what friends never see.
 */
export function FriendList({ memberId, families }: { memberId: string; families: FriendFamily[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const shown = families.filter((f) => !gone.has(f.connectionId));

  const path = (connectionId: string) => ({ params: { path: { memberId, connectionId } } });
  const accept = (f: FriendFamily) =>
    start(async () => {
      const { data } = await api.POST("/members/{memberId}/friend-connections/{connectionId}/accept", path(f.connectionId));
      if (!data) return void toast.error("Could not accept. Try again.");
      toast.success(`Connected with ${familyName(f.names)}.`);
      router.refresh();
    });
  const remove = (f: FriendFamily) =>
    start(async () => {
      const { response } = await api.DELETE("/members/{memberId}/friend-connections/{connectionId}", path(f.connectionId));
      if (!response.ok) return void toast.error("That did not work. Try again.");
      setConfirming(null);
      setGone((g) => new Set(g).add(f.connectionId));
      router.refresh();
    });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SoftCard as="section" aria-labelledby="friend-families" id="friend-families">
        <h2 id="friend-families" className="flex items-center gap-2 text-title">
          <UsersRound className="size-5 text-me" aria-hidden />
          Your friend families
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {shown.map((f) => (
              <motion.li
                key={f.connectionId}
                layout
                exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                transition={spring.ui}
                className={cn("rounded-2xl p-3.5", f.status === "incoming" ? "bg-me-soft" : "bg-muted")}
              >
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-label text-ink">{familyName(f.names)}</span>
                    <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                      {f.status === "connected" && "Connected"}
                      {f.status === "incoming" && "Asked to connect with you"}
                      {f.status === "outgoing" && (
                        <>
                          <Hourglass className="size-3.5" aria-hidden />
                          Waiting for them to accept
                        </>
                      )}
                    </span>
                  </span>
                  {f.status === "incoming" && (
                    <button type="button" disabled={pending} onClick={() => accept(f)} className="press min-h-11 rounded-full bg-me px-4 text-label font-semibold text-white disabled:opacity-60">
                      Accept
                    </button>
                  )}
                  {confirming !== f.connectionId && (
                    <button
                      type="button"
                      onClick={() => (f.status === "connected" ? setConfirming(f.connectionId) : remove(f))}
                      disabled={pending}
                      className="press min-h-11 rounded-full px-3 text-label font-normal text-muted-foreground hover:bg-card hover:text-ink"
                    >
                      {f.status === "incoming" ? "Decline" : f.status === "outgoing" ? "Cancel" : "Disconnect"}
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {confirming === f.connectionId && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.ui} className="overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2 pt-3">
                        <p className="min-w-0 flex-1 text-caption text-ink-2">They stop seeing your updates, and you theirs. Their hugs go too.</p>
                        <button type="button" onClick={() => setConfirming(null)} className="press min-h-11 rounded-full px-3 text-label font-normal text-ink-2 hover:bg-card">
                          Keep
                        </button>
                        <button type="button" disabled={pending} onClick={() => remove(f)} className="press min-h-11 rounded-full bg-ink px-4 text-label font-semibold text-paper disabled:opacity-60">
                          Disconnect
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {shown.length === 0 && <p className="text-label font-normal text-ink-2">Make a code above and send it to a family you know. You will both see it here once they connect.</p>}
      </SoftCard>
      <SoftCard tone="leaf" as="section" aria-labelledby="never-title">
        <h2 id="never-title" className="flex items-center gap-2 text-label text-leaf">
          <Lock className="size-4" aria-hidden />
          What friends never see
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-label font-normal text-ink">
          {["Your journal", "Moods and sleep", "Health and visits", "Your plan", "The baby passport", "Your caregivers"].map((x) => (
            <li key={x} className="flex items-center gap-2">
              <span aria-hidden className="size-1.5 rounded-full bg-leaf" />
              {x}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-ink-2">Only the updates you share below, as you wrote them. Remove one and it is gone for them too.</p>
      </SoftCard>
    </div>
  );
}
