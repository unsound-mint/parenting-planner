"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ListPlus, Minus, Plus, ShoppingBasket } from "lucide-react";
import { api } from "@/lib/api/client";
import type { ShoppingItem, SupplyItem } from "@/lib/api/types";
import { daysWords, starters, supplyIcon, withQuantity } from "@/lib/supplies";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";
import { duration, ease, spring } from "@/components/joy/motion";

const statusTone = {
  stocked: { bar: "bg-leaf", chip: "bg-leaf-soft text-leaf", label: "Stocked" },
  running_low: { bar: "bg-status-due", chip: "bg-butter text-ink", label: "Running low" },
  empty: { bar: "bg-status-late", chip: "bg-status-late-soft text-status-late", label: "Out" },
} as const;

export function SupplyCard({ memberId, item, essentialsOnly }: { memberId: string; item: SupplyItem; essentialsOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(item.quantity);
  const Icon = supplyIcon[item.category];
  const tone = statusTone[item.status];
  // Fill: how much of a comfortable stock is left. lowAt x 3 stands for "plenty".
  const full = Math.max(item.lowAt * 3, qty, 1);
  const fill = Math.min(100, Math.round((qty / full) * 100));

  function change(next: number) {
    const q = Math.max(0, next);
    setQty(q);
    startTransition(async () => {
      const { error } = await api.PATCH("/members/{memberId}/supply-items/{itemId}", {
        params: { path: { memberId, itemId: item.id } },
        body: withQuantity(item, q),
      });
      if (error) {
        setQty(item.quantity);
        toast.error(error.message ?? "Could not save the amount.");
        return;
      }
      router.refresh();
    });
  }

  function addToList() {
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/shopping-items", {
        params: { path: { memberId } },
        body: { name: item.name, supplyItemId: item.id, ...(item.lowAt > 0 ? { restockQuantity: Math.max(item.lowAt * 3, 1) } : {}) },
      });
      if (error) {
        toast.error(error.message ?? "Could not add to the list.");
        return;
      }
      toast.success(`${item.name} is on the shopping list`);
      router.refresh();
    });
  }

  const showDays = item.daysLeft !== undefined;
  return (
    <SoftCard as="article" tone={item.status === "stocked" ? "plain" : "sun"} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-title">
            {item.name}
            {item.size ? <span className="font-normal text-muted-foreground"> · {item.size}</span> : null}
          </h3>
          <p className="text-caption text-muted-foreground">
            {showDays ? `Runs out in ${daysWords(item.daysLeft!)}` : item.expiresOn ? `Expires ${formatShortDate(item.expiresOn)}` : tone.label}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-caption font-semibold", tone.chip)}>{tone.label}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <motion.div
            className={cn("h-full origin-left rounded-full", tone.bar)}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: fill / 100 }}
            transition={{ duration: duration.enter, ease: ease.out }}
            style={{ width: "100%" }}
          />
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={`One less ${item.name}`} disabled={pending || qty === 0} onClick={() => change(qty - 1)} className="press flex size-11 items-center justify-center rounded-full border border-line bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40">
            <Minus aria-hidden className="size-4" />
          </button>
          <p className="min-w-16 text-center font-mono text-title tabular-nums">
            <NumberFlow value={qty} />
            <span className="block text-caption font-normal text-muted-foreground">{item.unit}</span>
          </p>
          <button type="button" aria-label={`One more ${item.name}`} disabled={pending} onClick={() => change(qty + 1)} className="press flex size-11 items-center justify-center rounded-full border border-line bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40">
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      {showDays && !essentialsOnly && item.usagePerDay !== undefined && (
        <p className="font-mono text-caption text-muted-foreground">Estimate from your care log: about {Math.round(item.usagePerDay)} {item.unit} a day</p>
      )}
      {item.status !== "stocked" && !item.onShoppingList && (
        <button type="button" onClick={addToList} disabled={pending} className="press inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-ink px-4 text-label font-semibold text-paper outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ListPlus aria-hidden className="size-4" />
          Add to shopping list
        </button>
      )}
      {item.onShoppingList && (
        <p className="flex items-center gap-1.5 text-label text-leaf">
          <ShoppingBasket aria-hidden className="size-4" />
          On the shopping list
        </p>
      )}
    </SoftCard>
  );
}

/** Starter chips: one tap adds a usual item. Shown above the list so the page is never blank. */
export function AddSupply({ memberId, have }: { memberId: string; have: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const left = starters.filter((s) => !have.some((h) => h.toLowerCase() === s.name.toLowerCase()));
  if (left.length === 0) return null;
  function add(s: (typeof starters)[number]) {
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/supply-items", {
        params: { path: { memberId } },
        body: { name: s.name, category: s.category, quantity: s.quantity, unit: s.unit, lowAt: s.lowAt, ...(s.perUse ? { perUse: s.perUse } : {}) },
      });
      if (error) {
        toast.error(error.message ?? "Could not add it.");
        return;
      }
      toast.success(`${s.name} added`);
      router.refresh();
    });
  }
  return (
    <section aria-label="Add something" className="flex flex-col gap-2">
      <h2 className="font-mono text-caption tracking-[0.07em] text-muted-foreground uppercase">Add what you keep at home</h2>
      <div className="flex flex-wrap gap-2">
        {left.map((s) => (
          <button key={s.name} type="button" disabled={pending} onClick={() => add(s)} className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-label outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            <Plus aria-hidden className="size-4" />
            {s.name}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * The shared shopping list. Parents and a caregiver with care log access tick
 * rows; ticking a row linked to a supply with a restock amount adds that amount.
 * Reusable on the caregiver home: pass that caregiver's id as memberId.
 */
export function ShoppingList({ memberId, items, names }: { memberId: string; items: ShoppingItem[]; names: Record<string, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const isDone = (r: ShoppingItem) => local[r.id] ?? r.done;

  function tick(r: ShoppingItem) {
    const next = !isDone(r);
    setLocal((cur) => ({ ...cur, [r.id]: next }));
    startTransition(async () => {
      const { error } = await api.PATCH("/members/{memberId}/shopping-items/{itemId}", {
        params: { path: { memberId, itemId: r.id } },
        body: { done: next },
      });
      if (error) {
        setLocal((cur) => ({ ...cur, [r.id]: !next }));
        toast.error(error.message ?? "Could not update the list.");
        return;
      }
      if (next && r.restockQuantity) toast.success(`Stock updated, +${r.restockQuantity}`);
      router.refresh();
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = text.trim();
    if (!name) return;
    setText("");
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/shopping-items", { params: { path: { memberId } }, body: { name } });
      if (error) {
        setText(name);
        toast.error(error.message ?? "Could not add it.");
        return;
      }
      router.refresh();
    });
  }

  const open = items.filter((r) => !isDone(r));
  const done = items.filter(isDone);
  return (
    <SoftCard as="section" aria-labelledby="shopping-title" className="flex flex-col gap-4">
      <h2 id="shopping-title" className="text-title">
        Shopping list
      </h2>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={80}
          placeholder="Add something to buy"
          aria-label="Add something to buy"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-background px-4 text-body outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button type="submit" disabled={pending || !text.trim()} className="press min-h-11 rounded-full bg-ink px-4 text-label font-semibold text-paper outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40">
          Add
        </button>
      </form>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {[...open, ...done].map((r) => (
            <motion.li key={r.id} layout transition={spring.ui} className="border-t border-line first:border-t-0">
              <button type="button" onClick={() => tick(r)} aria-pressed={isDone(r)} className="press flex min-h-12 w-full items-center gap-3 rounded-xl py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-(--duration-fast)", isDone(r) ? "border-leaf bg-leaf text-white" : "border-line-2")}>
                  <Check aria-hidden className={cn("size-3.5 transition-transform duration-(--duration-base) ease-(--ease-out)", isDone(r) ? "scale-100" : "scale-0")} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-body transition-opacity duration-(--duration-base)", isDone(r) && "text-muted-foreground line-through opacity-70")}>{r.name}</span>
                  <span className="block font-mono text-caption text-muted-foreground">
                    {isDone(r) && r.doneById ? `Ticked by ${names[r.doneById] ?? "someone"}` : `Added by ${names[r.addedById] ?? "someone"}`}
                  </span>
                </span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </SoftCard>
  );
}
