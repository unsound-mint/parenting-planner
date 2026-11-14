import Link from "next/link";
import type { PlanItem } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { categoryIcon, statusTint } from "@/lib/visuals";
import { StatusPill } from "@/components/week/status-pill";

const MAX = 5;

// The rules-engine part of the journey: what is next for this parent.
export function ComingUp({ items, weekHref }: { items: PlanItem[]; weekHref: string }) {
  const next = items
    .filter((i) => i.status === "upcoming" || i.status === "due")
    .sort((a, b) => (a.dueBy ?? "9999-12-31").localeCompare(b.dueBy ?? "9999-12-31"))
    .slice(0, MAX);

  return (
    <section aria-labelledby="coming-up" className="mt-12 max-w-3xl">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="coming-up" className="text-title">
          Coming up
        </h2>
        <Link href={weekHref} className="text-label text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline">
          See this week
        </Link>
      </div>
      {next.length === 0 ? (
        <p className="text-body mt-3 text-muted-foreground">Nothing is coming up right now. We will add things here as your plan changes.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {next.map((item) => {
            const Icon = categoryIcon[item.category];
            return (
              <li key={item.ruleId} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", statusTint[item.status])}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold">{item.title}</p>
                  <p className="text-caption truncate font-mono text-muted-foreground">
                    {item.dueBy ? `By ${formatShortDate(item.dueBy)} · ` : ""}
                    {item.source.title}
                  </p>
                </div>
                <StatusPill status={item.status} className="text-caption" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
