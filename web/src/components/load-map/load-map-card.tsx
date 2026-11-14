"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, Check, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { LoadMap, LoadMapArea } from "@/lib/api/types";
import { areaIcon, countOf, totalOf, unitLabel, warmLine } from "@/lib/load-map";
import type { Person } from "@/lib/roles";
import { roleAccent } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/joy/partner-chip";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { spring } from "@/components/joy/motion";
import { SplitBar } from "./split-bar";

const POLL_MS = 20_000;

// "Who carries what": per area, a bar of who carries it now and a thin one of
// who thought of it first, over the last two weeks. All of it is counted by the
// API. "Hand over this area" only offers the tasks; they stay put until the
// other parent accepts, and the bar morphs when they do (the next refetch).
export function LoadMapCard({ memberId, initial, people }: { memberId: string; initial: LoadMap; people: Person[] }) {
  const [map, setMap] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const busyRef = useRef(false);
  const self = people.find((p) => p.id === memberId)!;
  const partner = people.find((p) => (p.role === "mother" || p.role === "partner") && p.id !== memberId);
  const parents = people.filter((p) => p.role === "mother" || p.role === "partner");

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    const { data } = await api.GET("/members/{memberId}/load-map", { params: { path: { memberId } } });
    if (data) setMap(data);
  }, [memberId]);

  // The other parent may accept while this screen is open: look again now and then.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function each(area: LoadMapArea, ids: string[], path: "reassignment/accept" | "reassignment", body?: { toMemberId: string }) {
    busyRef.current = true;
    setBusy(area.key);
    let failed = 0;
    for (const taskId of ids) {
      const res = await api.POST(`/members/{memberId}/tasks/{taskId}/${path}` as "/members/{memberId}/tasks/{taskId}/reassignment", {
        params: { path: { memberId, taskId } },
        body: body as { toMemberId: string },
      });
      if (res.error) failed++;
    }
    busyRef.current = false;
    setBusy(null);
    await refresh();
    return failed;
  }

  async function handOver(area: LoadMapArea) {
    if (!partner) return;
    const ids = area.handoverTaskIds;
    const failed = await each(area, ids, "reassignment", { toMemberId: partner.id });
    if (failed === ids.length) toast.error("Could not offer that. Please try again.");
    else toast(`Offered ${ids.length - failed} to ${partner.displayName}`, { description: "It stays with you until they accept." });
  }

  async function accept(area: LoadMapArea) {
    const ids = area.offeredToMeTaskIds;
    const failed = await each(area, ids, "reassignment/accept");
    if (failed === ids.length) {
      toast.error("Could not save that. Please try again.");
      return;
    }
    setCelebrate(area.key);
    setTimeout(() => setCelebrate((k) => (k === area.key ? null : k)), 1200);
    toast(`${ids.length - failed === 1 ? "It is" : "They are"} yours now`);
  }

  return (
    <SoftCard as="section" aria-labelledby="load-map-title" className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="load-map-title" className="text-headline">
            Who carries what
          </h2>
          <p className="mt-1 text-label font-normal text-muted-foreground">The last two weeks, counted from your plan and care log.</p>
        </div>
        <ul className="flex items-center gap-4 text-label text-ink-2">
          {parents.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5">
              <Avatar person={p} size="sm" />
              {p.id === memberId ? "You" : p.displayName}
            </li>
          ))}
        </ul>
      </header>

      <ul className="flex flex-col gap-1">
        {map.areas.map((area, n) => (
          <AreaRow
            key={area.key}
            area={area}
            n={n}
            people={people}
            self={self}
            partner={partner}
            busy={busy === area.key}
            celebrate={celebrate === area.key}
            onHandOver={() => handOver(area)}
            onAccept={() => accept(area)}
          />
        ))}
      </ul>
    </SoftCard>
  );
}

function AreaRow({
  area,
  n,
  people,
  self,
  partner,
  busy,
  celebrate,
  onHandOver,
  onAccept,
}: {
  area: LoadMapArea;
  n: number;
  people: Person[];
  self: Person;
  partner: Person | undefined;
  busy: boolean;
  celebrate: boolean;
  onHandOver: () => void;
  onAccept: () => void;
}) {
  const Icon = areaIcon[area.key];
  const total = totalOf(area.owned);
  const line = warmLine(area, self, partner, people);
  const mine = countOf(area.owned, self.id);
  const theirs = partner ? countOf(area.owned, partner.id) : 0;
  const offeredToMe = area.offeredToMeTaskIds.length;
  const offeredByMe = area.offeredByMeTaskIds.length;
  const canHandOver = !!partner && area.handoverTaskIds.length > 0;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.displayName ?? "Someone";
  const caption = area.owned.map((s) => `${s.memberId === self.id ? "You" : nameOf(s.memberId)} ${s.count}`).join(", ");

  return (
    <Rise as="li" i={n + 1} className="rounded-2xl p-3 transition-colors duration-150 hover:bg-muted/60 md:grid md:grid-cols-[11rem_1fr_auto] md:items-center md:gap-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sun text-ink-2">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-label font-semibold">{area.label}</p>
          <p className="font-mono text-caption text-muted-foreground">
            {total} {unitLabel(area.unit, total)}
          </p>
        </div>
      </div>

      <div className="relative mt-3 flex min-w-0 flex-col gap-1.5 md:mt-0">
        <SplitBar shares={area.owned} people={people} i={n} label={`Carries now: ${caption}`} />
        {area.started && (
          <div className="flex items-center gap-2">
            <SplitBar shares={area.started} people={people} i={n + 1} thin label={`Thought of first: ${area.started.map((s) => `${nameOf(s.memberId)} ${s.count}`).join(", ")}`} />
            <span className="shrink-0 text-caption text-muted-foreground">thought of</span>
          </div>
        )}
        <p className="flex justify-between font-mono text-caption text-muted-foreground">
          <span>{mine} you</span>
          {partner && (
            <span>
              {theirs} {partner.displayName}
            </span>
          )}
        </p>
        <AnimatePresence>
          {celebrate && <Sparkle key="spark" tone={roleAccent[self.role].bg} />}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex flex-col items-start gap-2 md:mt-0 md:items-end">
        {offeredToMe > 0 && partner ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label text-ink-2">
              {partner.displayName} offered you {offeredToMe}
            </span>
            <Button size="sm" disabled={busy} className="press min-h-11 gap-1.5 px-4" onClick={onAccept}>
              <Check aria-hidden className="size-4" />
              Take {offeredToMe === 1 ? "it" : "them"}
            </Button>
          </div>
        ) : canHandOver ? (
          <Button variant="outline" size="sm" disabled={busy} className="press min-h-11 gap-1.5 px-4" onClick={onHandOver}>
            <ArrowRightLeft aria-hidden className="size-4" />
            Hand over this area
          </Button>
        ) : offeredByMe > 0 && partner ? (
          <span className="inline-flex min-h-11 items-center gap-1.5 text-label text-muted-foreground">
            <Hourglass aria-hidden className="size-4" />
            Offered to {partner.displayName}
          </span>
        ) : null}
      </div>

      {line && <p className="mt-2 text-label font-normal text-ink-2 md:col-span-3 md:mt-0">{line}</p>}
    </Rise>
  );
}

// A small celebration when an area changes hands: a few butter dots drift out
// from the end of the bar and fade. Transform and opacity, once.
function Sparkle({ tone }: { tone: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute -top-3 right-1/2">
      {[-28, -10, 8, 26].map((x, k) => (
        <motion.span
          key={x}
          className={cn("absolute size-2 rounded-full bg-butter", k % 2 && tone)}
          initial={{ opacity: 0, scale: 0.4, x: 0, y: 8 }}
          animate={{ opacity: [0, 1, 0], scale: 1, x, y: -14 - (k % 2) * 6 }}
          exit={{ opacity: 0 }}
          transition={{ ...spring.playful, delay: k * 0.05, opacity: { duration: 0.9 } }}
        />
      ))}
    </span>
  );
}
