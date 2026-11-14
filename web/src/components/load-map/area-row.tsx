"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, Check, ChevronDown, Circle, CircleCheck, Hourglass, Undo2, X } from "lucide-react";
import type { LoadMapArea, LoadMapItem } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { areaIcon, countOf, totalOf, unitLabel, warmLine } from "@/lib/load-map";
import type { Person } from "@/lib/roles";
import { roleAccent } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/joy/partner-chip";
import { Rise } from "@/components/joy/rise";
import { spring } from "@/components/joy/motion";
import { SplitBar } from "./split-bar";
import { TakerPicker } from "./taker-picker";

// Where the numbers of a care area come from, for the open state.
const careSource: Record<string, { href: string; text: string }> = {
  feeding: { href: "care", text: "Counted from feeds in the care log." },
  diapers: { href: "care", text: "Counted from diaper changes in the care log." },
  nights: { href: "care", text: "Counted from care log entries between 22:00 and 06:00." },
  care_shifts: { href: "calendar", text: "Counted from the weekly hours of each active shift." },
};

type Props = {
  area: LoadMapArea;
  n: number;
  memberId: string;
  people: Person[];
  self: Person;
  takers: Person[];
  busy: boolean;
  celebrate: boolean;
  onOffer: (ids: string[], to: Person) => void;
  onAccept: (ids: string[]) => void;
  onDecline: (ids: string[]) => void;
  onWithdraw: (ids: string[]) => void;
};

export function AreaRow({ area, n, memberId, people, self, takers, busy, celebrate, onOffer, onAccept, onDecline, onWithdraw }: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const Icon = areaIcon[area.key];
  const total = totalOf(area.owned);
  const partner = people.find((p) => (p.role === "mother" || p.role === "partner") && p.id !== self.id);
  const line = warmLine(area, self, partner, people);
  const offeredToMe = area.offeredToMeTaskIds;
  const offeredByMe = area.offeredByMeTaskIds;
  const handover = area.handoverTaskIds;
  const isTaskArea = area.started !== undefined;
  const nameOf = (id: string) => (id === self.id ? "You" : (people.find((p) => p.id === id)?.displayName ?? "Someone"));
  const caption = area.owned.map((s) => `${nameOf(s.memberId)} ${s.count}`).join(", ");
  const offeredTo = [...new Set(area.items.filter((i) => offeredByMe.includes(i.taskId) && i.pendingAssigneeId).map((i) => nameOf(i.pendingAssigneeId!)))];
  const offerer = area.items.find((i) => offeredToMe.includes(i.taskId));

  // Parents first, in bar order (mother left), then anyone else with a share.
  const order = [...people.filter((p) => p.role === "mother" || p.role === "partner").map((p) => p.id), ...area.owned.map((s) => s.memberId)].filter((id, k, all) => all.indexOf(id) === k);
  const counts = order.filter((id) => id === self.id || id === partner?.id || countOf(area.owned, id) > 0);

  return (
    <Rise as="li" i={n + 1} className="mb-1 flex min-w-0 break-inside-avoid flex-col gap-3 rounded-2xl p-3 transition-colors duration-150 hover:bg-muted/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="group flex min-h-11 min-w-48 flex-1 items-center gap-2.5 rounded-xl text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sun text-ink-2">
            <Icon aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-label font-semibold">{area.label}</span>
            <span className="block font-mono text-caption text-muted-foreground">
              {total} {unitLabel(area.unit, total)}
            </span>
          </span>
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </button>
        {handover.length > 0 && (
          <Button variant="outline" size="sm" aria-expanded={choosing} disabled={busy} className="press min-h-11 shrink-0 gap-1.5 px-4" onClick={() => setChoosing((c) => !c)}>
            <ArrowRightLeft aria-hidden className="size-4" />
            Hand over this area
          </Button>
        )}
      </div>

      {offeredToMe.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-me-soft px-3 py-2">
          <span className="min-w-0 flex-1 text-label text-ink-2">
            {nameOf(offerer?.assigneeId ?? "")} offered you {offeredToMe.length === 1 ? "1 task" : `${offeredToMe.length} tasks`}
          </span>
          <Button size="sm" disabled={busy} className="press min-h-11 gap-1.5 px-4" onClick={() => onAccept(offeredToMe)}>
            <Check aria-hidden className="size-4" />
            Take {offeredToMe.length === 1 ? "it" : "them"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} className="press min-h-11 gap-1.5 px-3" onClick={() => onDecline(offeredToMe)}>
            Not now
          </Button>
        </div>
      )}

      {offeredByMe.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-label text-muted-foreground">
          <Hourglass aria-hidden className="size-4" />
          <span className="min-w-0 flex-1">
            Offered {offeredByMe.length === 1 ? "1 task" : `${offeredByMe.length} tasks`} to {offeredTo.join(" and ") || "someone"}, waiting for an answer
          </span>
          <Button variant="ghost" size="sm" disabled={busy} className="press min-h-11 gap-1.5 px-3" onClick={() => onWithdraw(offeredByMe)}>
            <Undo2 aria-hidden className="size-4" />
            Take it back
          </Button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {choosing && handover.length > 0 && (
          <motion.div key="choose" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.ui} className="rounded-xl bg-muted/60 p-3">
            <TakerPicker
              takers={takers}
              disabled={busy}
              label={`Offer ${handover.length === 1 ? "this task" : `these ${handover.length} tasks`} to`}
              onPick={(to) => {
                setChoosing(false);
                onOffer(handover, to);
              }}
            />
            <p className="mt-2 text-caption text-muted-foreground">It stays with you until they accept. You can take it back any time before.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-col gap-1.5">
        <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
          <span className="text-caption font-medium text-ink-2">{isTaskArea ? "Doing" : "Did"}</span>
          <SplitBar shares={area.owned} people={people} i={n} label={`${isTaskArea ? "Doing" : "Did"}: ${caption}`} />
          {area.started && (
            <>
              <span className="text-caption text-muted-foreground">Noticed first</span>
              <SplitBar shares={area.started} people={people} i={n + 1} thin label={`Noticed first: ${area.started.map((s) => `${nameOf(s.memberId)} ${s.count}`).join(", ")}`} />
            </>
          )}
        </div>
        <p className="flex justify-between gap-3 pl-[5.5rem] font-mono text-caption text-muted-foreground">
          {counts.map((id) => {
            const who = people.find((p) => p.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1.5">
                <i aria-hidden className={cn("size-2 rounded-full", who ? roleAccent[who.role].bg : "bg-muted-foreground")} />
                {nameOf(id)} {countOf(area.owned, id)}
              </span>
            );
          })}
        </p>
        {line && <p className="text-label font-normal text-ink-2">{line}</p>}
        <AnimatePresence>{celebrate && <Sparkle key="spark" tone={roleAccent[self.role].bg} />}</AnimatePresence>
      </div>

      {/* The area's contents. 0fr to 1fr animates the height without measuring it. */}
      <div id={panelId} className={cn("grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          {isTaskArea ? (
            <ul className="flex flex-col divide-y divide-line border-t border-line">
              {area.items.map((it) => (
                <ItemRow key={it.taskId} item={it} memberId={memberId} self={self} people={people} takers={takers} busy={busy} onOffer={onOffer} onAccept={onAccept} onDecline={onDecline} onWithdraw={onWithdraw} />
              ))}
            </ul>
          ) : (
            <p className="border-t border-line pt-3 text-label font-normal text-muted-foreground">
              {careSource[area.key]?.text}{" "}
              {careSource[area.key] && (
                <Link href={`/family/${memberId}/${careSource[area.key].href}`} className="text-ink underline decoration-line-2 underline-offset-3 hover:decoration-ink">
                  Open it
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
    </Rise>
  );
}

function ItemRow({
  item,
  memberId,
  self,
  people,
  takers,
  busy,
  onOffer,
  onAccept,
  onDecline,
  onWithdraw,
}: {
  item: LoadMapItem;
  memberId: string;
  self: Person;
  people: Person[];
  takers: Person[];
  busy: boolean;
  onOffer: (ids: string[], to: Person) => void;
  onAccept: (ids: string[]) => void;
  onDecline: (ids: string[]) => void;
  onWithdraw: (ids: string[]) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const who = (id: string) => people.find((p) => p.id === id);
  const doing = who(item.assigneeId);
  const noticed = who(item.createdById);
  const mine = item.assigneeId === self.id;
  const offered = item.pendingAssigneeId;
  const toMe = offered === self.id;
  const offeredName = offered ? (offered === self.id ? "you" : (who(offered)?.displayName ?? "someone")) : undefined;
  const Mark = item.done ? CircleCheck : Circle;

  return (
    <li className="flex flex-col gap-2 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Mark aria-hidden className={cn("size-4 shrink-0", item.done ? "text-leaf" : "text-muted-foreground")} />
        <Link href={`/family/${memberId}/plan?task=${item.taskId}`} className={cn("min-w-0 flex-1 text-label underline-offset-3 hover:underline", item.done && "text-muted-foreground line-through")}>
          {item.title}
          <span className="sr-only">, open in the plan</span>
        </Link>
        {item.dueOn && <span className="font-mono text-caption text-muted-foreground">{formatShortDate(item.dueOn)}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-7 text-caption text-muted-foreground">
        {doing && (
          <span className="inline-flex items-center gap-1.5">
            {item.done ? "Did" : "Doing"}
            <Avatar person={doing} size="sm" />
            <span className="text-ink-2">{doing.id === self.id ? "You" : doing.displayName}</span>
          </span>
        )}
        {noticed && (
          <span className="inline-flex items-center gap-1.5">
            Noticed first
            <Avatar person={noticed} size="sm" />
            <span className="text-ink-2">{noticed.id === self.id ? "You" : noticed.displayName}</span>
          </span>
        )}
        {offered && !toMe && (
          <span className="inline-flex items-center gap-1.5">
            <Hourglass aria-hidden className="size-3.5" />
            Offered to {offeredName}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {toMe && (
            <>
              <Button size="sm" disabled={busy} className="press min-h-9 gap-1 px-3" onClick={() => onAccept([item.taskId])}>
                <Check aria-hidden className="size-3.5" />
                Take it
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} className="press min-h-9 px-3" onClick={() => onDecline([item.taskId])}>
                Not now
              </Button>
            </>
          )}
          {mine && !item.done && offered && !toMe && (
            <Button variant="ghost" size="sm" disabled={busy} className="press min-h-9 gap-1 px-3" onClick={() => onWithdraw([item.taskId])}>
              <Undo2 aria-hidden className="size-3.5" />
              Take it back
            </Button>
          )}
          {mine && !item.done && !offered && (
            <Button variant="ghost" size="sm" aria-expanded={choosing} disabled={busy} className="press min-h-9 gap-1 px-3" onClick={() => setChoosing((c) => !c)}>
              {choosing ? <X aria-hidden className="size-3.5" /> : <ArrowRightLeft aria-hidden className="size-3.5" />}
              {choosing ? "Cancel" : "Hand over"}
            </Button>
          )}
        </span>
      </div>
      {choosing && (
        <div className="ml-7 rounded-xl bg-muted/60 p-3">
          <TakerPicker
            takers={takers}
            disabled={busy}
            label="Offer this task to"
            onPick={(to) => {
              setChoosing(false);
              onOffer([item.taskId], to);
            }}
          />
        </div>
      )}
    </li>
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
