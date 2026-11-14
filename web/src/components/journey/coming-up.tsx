import Link from "next/link";
import type { PlanItem } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { StatusPill } from "@/components/week/status-pill";

const MAX = 5;

// The rules-engine part of the journey: what is next for this parent.
export function ComingUp({ items, weekHref }: { items: PlanItem[]; weekHref: string }) {
  const next = items
    .filter((i) => i.status === "upcoming" || i.status === "due")
    .sort((a, b) => (a.dueBy ?? "9999-12-31").localeCompare(b.dueBy ?? "9999-12-31"))
    .slice(0, MAX);

  return (
    <section aria-labelledby="coming-up" className="mt-10 max-w-3xl">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="coming-up" className="text-lg font-semibold tracking-tight">
          Coming up
        </h2>
        <Link href={weekHref} className="text-sm text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline">
          See this week
        </Link>
      </div>
      {next.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing is coming up right now. We will add things here as your plan changes.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {next.map((item) => (
            <li key={item.ruleId} className="flex flex-col gap-1.5 py-3.5 sm:flex-row sm:items-start sm:gap-4">
              <StatusPill status={item.status} className="self-start sm:mt-0.5 sm:w-20 sm:justify-center" />
              <div className="min-w-0">
                <p className="text-[15px] leading-snug font-medium">{item.title}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {item.dueBy ? `By ${formatShortDate(item.dueBy)} · ` : ""}
                  {item.source.title}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
