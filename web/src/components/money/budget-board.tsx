"use client";

import { useState, useTransition } from "react";
import { ChevronDown, PiggyBank, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Budget, BudgetCategory, BudgetItem, BudgetItemInput, BudgetPayer } from "@/lib/api/types";
import { categories, categoryMeta, dollars, payerBg, toCents, toDollarsField } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/joy/partner-chip";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";
import { PageGrid } from "@/components/shell/page";
import { CountUp, GrowBar, Wipe } from "./motion";

type Parents = { mother?: { id: string; displayName: string }; partner?: { id: string; displayName: string } };

/** Reads the budget the page loaded, reloads it after every change so both parents see the same numbers. */
export function BudgetBoard({
  memberId,
  initial,
  parents,
  leaveHint,
  children,
}: {
  memberId: string;
  initial: Budget;
  parents: Parents;
  /** From the leave planner when it has data: weeks without pay for one parent. */
  leaveHint?: { weeks: number; who: string };
  /** The second column next to the budget: the birth cost planner. */
  children?: React.ReactNode;
}) {
  const [budget, setBudget] = useState(initial);
  // router.refresh() (the childcare card adds budget lines) hands us a new server copy.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setBudget(initial);
  }
  const [open, setOpen] = useState<BudgetCategory | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, start] = useTransition();
  const path = { params: { path: { memberId } } };

  async function reload() {
    const { data } = await api.GET("/members/{memberId}/budget", path);
    if (data) setBudget(data);
  }

  async function save(body: BudgetItemInput, id?: string) {
    const res = id
      ? await api.PUT("/members/{memberId}/budget-items/{itemId}", { params: { path: { memberId, itemId: id } }, body })
      : await api.POST("/members/{memberId}/budget-items", { ...path, body });
    if (res.error) {
      toast.error("Could not save that line. Please try again.");
      return false;
    }
    await reload();
    return true;
  }

  function remove(id: string) {
    start(async () => {
      const { error } = await api.DELETE("/members/{memberId}/budget-items/{itemId}", { params: { path: { memberId, itemId: id } } });
      if (error) toast.error("Could not remove that line.");
      else await reload();
    });
  }

  const maxCat = Math.max(1, ...budget.byCategory.map((c) => c.firstYearCents));
  const byPayer = Object.fromEntries(budget.byPayer.map((p) => [p.payer, p])) as Record<BudgetPayer, Budget["byPayer"][number]>;
  const total = Math.max(1, budget.total.firstYearCents);
  const named = (p: BudgetPayer) => (p === "mother" ? parents.mother?.displayName : p === "partner" ? parents.partner?.displayName : "Together") ?? p;

  return (
    <>
      <SoftCard tone="sun" hero as="section" aria-labelledby="money-hero" className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-label text-ink-2">
            <span className="grid size-9 place-items-center rounded-full bg-butter/70 text-ink">
              <PiggyBank aria-hidden className="size-5" />
            </span>
            Our first year with the baby
          </p>
          <h1 id="money-hero" className="mt-3 text-display">
            About <CountUp value={budget.total.firstYearCents} format={dollars} />
          </h1>
          <p className="mt-2 font-mono text-label text-ink-2">
            {dollars(budget.total.oneTimeCents)} once · {dollars(budget.total.monthlyCents)} a month
          </p>
        </div>
        <div className="w-full md:max-w-md">
          <Wipe className="flex h-4 w-full overflow-hidden bg-card/70">
            {(["mother", "partner", "shared"] as const).map((p) => (
              <span key={p} className={cn("h-full", payerBg[p])} style={{ width: `${(byPayer[p].firstYearCents / total) * 100}%` }} />
            ))}
          </Wipe>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-label">
            {(["mother", "partner", "shared"] as const).map((p) => (
              <li key={p} className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 truncate text-ink-2">
                  <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", payerBg[p])} />
                  <span className="truncate">{named(p)}</span>
                </span>
                <CountUp value={byPayer[p].firstYearCents} format={dollars} className="font-mono text-body text-ink" />
              </li>
            ))}
          </ul>
        </div>
      </SoftCard>

      <PageGrid>
      <SoftCard as="section" aria-labelledby="budget-title" className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="budget-title" className="text-title">
            Where it goes
          </h2>
          <button
            type="button"
            onClick={() => setEditing(editing === "new" ? null : "new")}
            className="press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-label font-medium text-primary-foreground md:min-h-9"
          >
            {editing === "new" ? <X aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
            {editing === "new" ? "Close" : "Add a line"}
          </button>
        </div>

        {editing === "new" && (
          <ItemForm
            parents={parents}
            onCancel={() => setEditing(null)}
            onSave={async (b) => {
              if (await save(b)) {
                setEditing(null);
                setOpen(b.category);
              }
            }}
          />
        )}

        {budget.suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-label text-muted-foreground">Typical lines, all estimates. Tap to add, then change the amount.</p>
            <ul className="flex flex-wrap gap-2">
              {budget.suggestions.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => void save({ category: s.category, name: s.name, amountCents: s.amountCents, cadence: s.cadence, payer: s.payer }).then((ok) => ok && setOpen(s.category))}
                    title={s.source ? `${s.source.title}` : "A starting amount from us, not advice"}
                    className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3 text-label text-ink-2 transition-colors duration-(--duration-fast) hover:bg-muted md:min-h-9"
                  >
                    <Plus aria-hidden className="size-3.5" />
                    {s.name}
                    <span className="font-mono text-caption text-muted-foreground">
                      {dollars(s.amountCents)}
                      {s.cadence === "monthly" ? "/mo" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <SourceLine className="mt-2" sources={budget.suggestions.flatMap((s) => (s.source ? [s.source] : [])).filter((s, i, a) => a.findIndex((x) => x.url === s.url) === i)} />
          </div>
        )}

        {leaveHint && !budget.items.some((i) => i.category === "leave") && (
          <button
            type="button"
            onClick={() => void save({ category: "leave", name: `Income lost on unpaid leave (${leaveHint.who})`, amountCents: 0, cadence: "once", payer: "shared" }).then((ok) => ok && setOpen("leave"))}
            className="press rounded-2xl bg-leaf-soft px-4 py-3 text-left text-label text-ink-2"
          >
            Your leave plan has {leaveHint.weeks} unpaid {leaveHint.weeks === 1 ? "week" : "weeks"} for {leaveHint.who}. Add a line for the lost pay.
          </button>
        )}

        <ul className="flex flex-col gap-1">
          {budget.byCategory.map((c, n) => {
            const meta = categoryMeta[c.category];
            const items = budget.items.filter((i) => i.category === c.category);
            const isOpen = open === c.category;
            return (
              <li key={c.category} className="rounded-2xl">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : c.category)}
                  className="press flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors duration-(--duration-fast) hover:bg-muted"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-ink-2">
                    <meta.icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-body">{meta.label}</span>
                      <span className="font-mono text-label">{dollars(c.firstYearCents)}</span>
                    </span>
                    <span className="mt-1.5 block h-2 rounded-full bg-muted">
                      <GrowBar ratio={c.firstYearCents / maxCat} delay={n * 60} className="bg-primary/80" />
                    </span>
                  </span>
                  <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) ease-(--ease-out)", isOpen && "rotate-180")} />
                </button>
                <div className={cn("grid transition-[grid-template-rows] duration-(--duration-base) ease-(--ease-out)", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <ul className="flex flex-col gap-1 py-1 pl-14 pr-2">
                      {items.map((it) => (
                        <li key={it.id}>
                          {editing === it.id ? (
                            <ItemForm
                              item={it}
                              parents={parents}
                              onCancel={() => setEditing(null)}
                              onSave={async (b) => (await save(b, it.id)) && setEditing(null)}
                              onDelete={() => {
                                setEditing(null);
                                remove(it.id);
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              tabIndex={isOpen ? 0 : -1}
                              onClick={() => setEditing(it.id)}
                              className="press flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left transition-colors duration-(--duration-fast) hover:bg-muted"
                            >
                              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", payerBg[it.payer])} />
                              <span className="min-w-0 flex-1 truncate text-label">{it.name}</span>
                              <span className="font-mono text-label">
                                {dollars(it.amountCents)}
                                <span className="text-muted-foreground">{it.cadence === "monthly" ? " /mo" : ""}</span>
                              </span>
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Avatar person={{ displayName: parents.mother?.displayName ?? "M", role: "mother" }} size="sm" />
            and
            <Avatar person={{ displayName: parents.partner?.displayName ?? "P", role: "partner" }} size="sm" />
            both edit this budget. Grandparents and nannies never see it.
          </span>
        </p>
      </SoftCard>
      {children}
      </PageGrid>
    </>
  );
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; dot?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "press flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-label transition-colors duration-(--duration-fast) md:min-h-8",
            value === o.id ? "bg-card text-ink shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.dot && <span aria-hidden className={cn("size-2 rounded-full", o.dot)} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const field = "h-11 w-full min-w-0 rounded-xl border border-line-2 bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-label";

function ItemForm({
  item,
  parents,
  onSave,
  onCancel,
  onDelete,
}: {
  item?: BudgetItem;
  parents: Parents;
  onSave: (b: BudgetItemInput) => Promise<unknown>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item ? toDollarsField(item.amountCents) : "");
  const [cadence, setCadence] = useState(item?.cadence ?? "once");
  const [payer, setPayer] = useState<BudgetPayer>(item?.payer ?? "shared");
  const [category, setCategory] = useState<BudgetCategory>(item?.category ?? "equipment");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        await onSave({ name: name.trim(), amountCents: toCents(amount), cadence, payer, category });
        setBusy(false);
      }}
      className="rise flex flex-col gap-3 rounded-2xl bg-muted p-3"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <input aria-label="What for" placeholder="What is it for?" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={field} />
        <label className="relative block">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <input aria-label="Amount in dollars" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(field, "pl-6 font-mono")} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Seg label="How often" value={cadence} onChange={setCadence} options={[{ id: "once", label: "Once" }, { id: "monthly", label: "Every month" }]} />
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as BudgetCategory)} className={field}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryMeta[c].label}
            </option>
          ))}
        </select>
      </div>
      <Seg
        label="Who pays"
        value={payer}
        onChange={setPayer}
        options={[
          { id: "mother", label: parents.mother?.displayName ?? "Mom", dot: payerBg.mother },
          { id: "partner", label: parents.partner?.displayName ?? "Partner", dot: payerBg.partner },
          { id: "shared", label: "Together", dot: payerBg.shared },
        ]}
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy || !name.trim()} className="press min-h-11 rounded-full bg-primary px-5 text-label font-medium text-primary-foreground disabled:opacity-50 md:min-h-9">
          {item ? "Save" : "Add to budget"}
        </button>
        <button type="button" onClick={onCancel} className="press min-h-11 rounded-full px-4 text-label text-muted-foreground hover:text-ink md:min-h-9">
          Cancel
        </button>
        <span className="flex-1" />
        {onDelete && (
          <button type="button" onClick={onDelete} aria-label="Remove this line" className="press grid size-11 place-items-center rounded-full text-muted-foreground hover:text-status-late md:size-9">
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
}
