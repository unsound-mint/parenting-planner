"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { StageMascot } from "@/components/illustrations";
import { spring, stagger } from "@/components/joy/motion";
import type { Friends, FriendUpdate, Stage } from "@/lib/api/types";
import { countWord } from "@/lib/format";
import { FamilyFaces, FriendList } from "./friend-list";
import { CodeCard } from "./code-card";
import { ShareComposer } from "./share-composer";
import { UpdateCard } from "./update-card";

/**
 * Friend families. The hero says who is cheering the family on and holds the
 * code to connect; below it the composer and the shared updates (the family's
 * own and its friends'), and beside them the friend families themselves with
 * what they can never see. A new share drops into the top of the list.
 */
export function FriendsBoard({ memberId, myName, stage, friends }: { memberId: string; myName: string; stage: Stage; friends: Friends }) {
  const [added, setAdded] = useState<FriendUpdate[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const known = new Set(friends.updates.map((u) => u.id));
  const updates = [...added.filter((u) => !known.has(u.id)), ...friends.updates].filter((u) => !removed.has(u.id));
  const connected = friends.families.filter((f) => f.status === "connected");
  const incoming = friends.families.filter((f) => f.status === "incoming").length;

  const headline =
    connected.length === 0
      ? "Bring in the families you share this time with"
      : `${countWord(connected.length)} ${connected.length === 1 ? "family is" : "families are"} cheering you on`;

  return (
    <>
      <Rise i={0}>
        <SoftCard tone="sun" hero className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @7xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)_14rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-caption font-semibold tracking-wider text-ink-2 uppercase">Friend families</p>
            <h1 className="text-display text-balance">{headline}</h1>
            <p className="max-w-prose text-body text-ink-2">
              They see only what you share here, one moment at a time, and can send a hug back. Never your journal, moods or health.
            </p>
            {connected.length > 0 && <FamilyFaces families={connected} />}
            {incoming > 0 && (
              <a href="#friend-families" className="w-fit rounded-full bg-me px-4 py-2 text-label font-semibold text-white">
                {incoming === 1 ? "A family asked to connect" : `${countWord(incoming)} families asked to connect`}
              </a>
            )}
          </div>
          <CodeCard memberId={memberId} code={friends.code} />
          <div className="hidden aspect-[300/260] self-end @7xl:block" aria-hidden>
            <StageMascot stage={stage} heart />
          </div>
        </SoftCard>
      </Rise>

      <div className="grid min-w-0 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @7xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_24rem]">
        <Rise as="section" i={1} aria-labelledby="share-title" className="flex min-w-0 flex-col gap-3 @7xl:col-span-2">
          <ShareComposer
            memberId={memberId}
            stage={stage}
            reach={connected.length}
            onShared={(u) => setAdded((a) => [u, ...a])}
          />
          <h2 className="sr-only">Shared updates</h2>
          <ul className="grid min-w-0 items-start gap-3 @7xl:grid-cols-2">
            <AnimatePresence initial={false}>
              {updates.map((u, n) => (
                <motion.li
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { ...spring.ui, delay: added.some((a) => a.id === u.id) ? 0 : Math.min(n, 6) * stagger } }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                  transition={spring.ui}
                  className="min-w-0"
                >
                  <UpdateCard memberId={memberId} myName={myName} update={u} onRemoved={() => setRemoved((r) => new Set(r).add(u.id))} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Rise>
        <Rise as="aside" i={2} className="min-w-0">
          <FriendList memberId={memberId} families={friends.families} />
        </Rise>
      </div>
    </>
  );
}
