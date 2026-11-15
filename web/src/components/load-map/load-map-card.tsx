"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { LoadMap, LoadMapArea } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { Avatar } from "@/components/joy/partner-chip";
import { SoftCard } from "@/components/joy/soft-card";
import { AreaRow } from "./area-row";

const POLL_MS = 20_000;

type Step =
  | "reassignment"
  | "reassignment/accept"
  | "reassignment/decline"
  | "reassignment/withdraw";

// "Who carries what": per area, a thick bar of who is doing it and a thin one of
// who noticed it first, over the last two weeks. All of it is counted by the API.
// Each area opens to its tasks. A task or a whole area can be offered to anyone
// the API lists as a taker; it stays with its owner until they accept, and the
// owner can take the offer back. The bars morph on the next refetch.
export function LoadMapCard({
  memberId,
  initial,
  people,
}: {
  memberId: string;
  initial: LoadMap;
  people: Person[];
}) {
  const [map, setMap] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const busyRef = useRef(false);
  const self = people.find((p) => p.id === memberId)!;
  const parents = people.filter(
    (p) => p.role === "mother" || p.role === "partner",
  );
  const takers = map.takers
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => !!p);

  const others = people.filter(
    (p) => p.id !== memberId && !takers.some((t) => t.id === p.id),
  );

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    const { data } = await api.GET("/members/{memberId}/load-map", {
      params: { path: { memberId } },
    });
    if (data) setMap(data);
  }, [memberId]);

  // Someone may answer while this screen is open: look again now and then.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  /** Runs one reassignment step on each task; returns how many failed. */
  async function each(
    key: string,
    ids: string[],
    step: Step,
    body?: { toMemberId: string },
  ) {
    busyRef.current = true;
    setBusy(key);
    let failed = 0;
    for (const taskId of ids) {
      const res = await api.POST(
        `/members/{memberId}/tasks/{taskId}/${step}` as "/members/{memberId}/tasks/{taskId}/reassignment",
        {
          params: { path: { memberId, taskId } },
          body: body as { toMemberId: string },
        },
      );
      if (res.error) failed++;
    }
    busyRef.current = false;
    setBusy(null);
    await refresh();
    return failed;
  }

  async function offer(key: string, ids: string[], to: Person) {
    const failed = await each(key, ids, "reassignment", { toMemberId: to.id });
    if (failed === ids.length)
      toast.error("Could not offer that. Please try again.");
    else
      toast(
        `Offered ${ids.length - failed === 1 ? "1 task" : `${ids.length - failed} tasks`} to ${to.displayName}`,
        { description: "It stays with you until they accept." },
      );
  }

  async function accept(key: string, ids: string[]) {
    const failed = await each(key, ids, "reassignment/accept");
    if (failed === ids.length) {
      toast.error("Could not save that. Please try again.");
      return;
    }
    setCelebrate(key);
    setTimeout(() => setCelebrate((k) => (k === key ? null : k)), 1200);
    toast(`${ids.length - failed === 1 ? "It is" : "They are"} yours now`);
  }

  async function decline(key: string, ids: string[]) {
    const failed = await each(key, ids, "reassignment/decline");
    if (failed === ids.length)
      toast.error("Could not save that. Please try again.");
    else
      toast("Left with them", { description: "Nothing changed on your side." });
  }

  async function withdraw(key: string, ids: string[]) {
    const failed = await each(key, ids, "reassignment/withdraw");
    if (failed === ids.length)
      toast.error("Could not take that back. Please try again.");
    else toast("Offer taken back", { description: "It is still with you." });
  }

  return (
    <SoftCard
      as="section"
      aria-labelledby="load-map-title"
      className="@container flex flex-col gap-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="max-w-prose">
          <h2 id="load-map-title" className="text-headline">
            Who carries what
          </h2>
          <p className="mt-1 text-label font-normal text-muted-foreground">
            The last two weeks, counted from your plan and care log. Open an
            area to see what is in it.
          </p>
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

      {/* The legend is one quiet line: a boxed two-column key competed with the bars it explains. */}
      <p className="-mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-caption text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden className="block h-2.5 w-6 rounded-full bg-ink-2/70" />
          Doing: who has the task, or logged the feed, change or night
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="block h-1 w-6 rounded-full bg-ink-2/70" />
          Noticed first: who put it on the plan. Remembering is work too.
        </span>
      </p>

      {/* Two fixed columns, first half left and second half right: reading order stays the
          same on a phone, and opening an area only pushes down its own column. CSS columns
          rebalanced unevenly once an area opened. */}
      <div className="grid gap-x-6 @2xl:grid-cols-2 @2xl:items-start">
        {halves(map.areas).map(([offset, areas]) => (
          <ul key={offset} className="min-w-0">
            {areas.map((area, n) => (
              <AreaRow
                key={area.key}
                area={area}
                n={offset + n}
                memberId={memberId}
                people={people}
                self={self}
                takers={takers}
                others={others}
                busy={busy === area.key}
                celebrate={celebrate === area.key}
                onOffer={(ids, to) => offer(area.key, ids, to)}
                onAccept={(ids) => accept(area.key, ids)}
                onDecline={(ids) => decline(area.key, ids)}
                onWithdraw={(ids) => withdraw(area.key, ids)}
              />
            ))}
          </ul>
        ))}
      </div>
    </SoftCard>
  );
}

export type { LoadMapArea };

function halves<T>(items: T[]): [number, T[]][] {
  const cut = Math.ceil(items.length / 2);
  return [
    [0, items.slice(0, cut)],
    [cut, items.slice(cut)],
  ];
}
