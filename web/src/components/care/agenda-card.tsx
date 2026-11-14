"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical, Lock, X } from "lucide-react";
import type { AgendaTopic } from "@/lib/api/types";
import { careIcon } from "@/lib/visuals";

// Topics for the next session, as the parent chose them. Topics only: private
// text never reaches the agenda. The contract has no endpoint to change the
// agenda yet, so reordering and removing only shape this view, not the stored list.
export function AgendaCard({ topics }: { topics: AgendaTopic[] }) {
  const [items, setItems] = useState(topics);
  const Agenda = careIcon.agenda;
  return (
    <section aria-labelledby="agenda-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Agenda className="size-4.5" aria-hidden />
        </span>
        <h2 id="agenda-title" className="flex-1 text-title">
          Your agenda
        </h2>
        <span className="font-mono text-title tabular-nums" aria-label={`${items.length} topics`}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-label text-muted-foreground">Nothing yet. Topics you add for your psychologist show up here.</p>
      ) : (
        <Reorder.Group axis="y" values={items} onReorder={setItems} className="mt-4 flex flex-col gap-2">
          {items.map((t, i) => (
            <Topic key={t.id} topic={t} index={i} count={items.length} onMove={(to) => move(items, setItems, i, to)} onRemove={() => setItems(items.filter((x) => x.id !== t.id))} />
          ))}
        </Reorder.Group>
      )}

      <p className="mt-4 flex items-center gap-2 text-caption text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Topics only. Your partner cannot see this.
      </p>
    </section>
  );
}

function move(items: AgendaTopic[], set: (v: AgendaTopic[]) => void, from: number, to: number) {
  if (to < 0 || to >= items.length) return;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  set(next);
}

function Topic({ topic, index, count, onMove, onRemove }: { topic: AgendaTopic; index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={topic}
      dragListener={false}
      dragControls={controls}
      className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background py-1 pr-1 pl-1 select-none"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)" }}
    >
      <button
        type="button"
        aria-label={`Move "${topic.text}"; use arrow keys or drag`}
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onMove(index + (e.key === "ArrowUp" ? -1 : 1));
          }
        }}
        className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-caption font-semibold text-secondary-foreground" aria-hidden>
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 py-1 text-label text-foreground">{topic.text}</span>
      <button
        type="button"
        aria-label={`Remove "${topic.text}" (${index + 1} of ${count})`}
        onClick={onRemove}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X className="size-4" aria-hidden />
      </button>
    </Reorder.Item>
  );
}
