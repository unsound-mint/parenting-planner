import Link from "next/link";
import { CalendarCheck, CircleCheck, HandHeart, MousePointerClick, Table2, type LucideIcon } from "lucide-react";
import type { Analytics, AnalyticsMetric } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { metricLabel, templateLabel } from "./labels";

const tiles: { metric: AnalyticsMetric; icon: LucideIcon }[] = [
  { metric: "demo_started", icon: HandHeart },
  { metric: "task_done", icon: CircleCheck },
  { metric: "booking_requested", icon: CalendarCheck },
  { metric: "partner_offer_clicked", icon: MousePointerClick },
];

const ranges = [7, 14, 30];

// Counts only (docs: the endpoint never returns ids or text). One axis per
// chart, one series per chart, so there is no legend; the tables hold the same
// numbers for screen readers.
export function AnalyticsView({ data, days }: { data: Analytics; days: number }) {
  const by = Object.fromEntries(data.series.map((s) => [s.metric, s])) as Record<AnalyticsMetric, Analytics["series"][number]>;
  const demos = by.demo_started;
  const templates = [...data.templates].sort((a, b) => b.families - a.families);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-label text-muted-foreground">
          {formatShortDate(data.from)} to {formatShortDate(data.to)}
        </p>
        <nav aria-label="Time range" className="flex gap-2">
          {ranges.map((d) => (
            <Link
              key={d}
              href={`/admin?tab=analytics&days=${d}`}
              aria-current={d === days ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-label transition-colors duration-150 md:min-h-9",
                d === days ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(({ metric, icon: Icon }) => (
          <li key={metric} className="rounded-2xl border border-border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-3 font-mono text-display">{by[metric].total}</p>
            <p className="text-label text-muted-foreground">{metricLabel[metric]}</p>
          </li>
        ))}
      </ul>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section aria-labelledby="chart-days" className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <h2 id="chart-days" className="text-title">
          Demos started per day
        </h2>
        <div className="hidden md:block">
          <DailyBars points={demos.days} label="demos started" W={900} />
        </div>
        <div className="md:hidden">
          <DailyBars points={demos.days} label="demos started" W={340} />
        </div>
        <TableView caption="Demos started per day" head={["Day", "Demos"]} rows={demos.days.map((d) => [formatShortDate(d.date), String(d.count)])} />
      </section>

      <section aria-labelledby="chart-templates" className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <h2 id="chart-templates" className="text-title">
          Which family people pick
        </h2>
        <ul className="mt-4 grid gap-3">
          {templates.map((t) => (
            <li key={t.template} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-label md:grid-cols-[7rem_1fr_3rem]">
              <span>{templateLabel[t.template]}</span>
              <span className="h-2 rounded-full bg-muted" aria-hidden>
                <span className="block h-2 rounded-full bg-chart-3" style={{ width: `${(t.families / Math.max(1, templates[0].families)) * 100}%` }} />
              </span>
              <span className="text-right font-mono">{t.families}</span>
            </li>
          ))}
        </ul>
      </section>
      </div>

      <TableView
        caption="Everything counted"
        head={["Event", "Total"]}
        rows={data.series.map((s) => [metricLabel[s.metric], String(s.total)])}
        label="Show every count"
        standalone
      />
    </div>
  );
}

function TableView({ caption, head, rows, label = "Table view", standalone }: { caption: string; head: string[]; rows: string[][]; label?: string; standalone?: boolean }) {
  return (
    <details className={cn("group", standalone ? "-mt-2" : "mt-3")}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <Table2 className="size-4" aria-hidden />
        {label}
      </summary>
      <table className="mt-2 w-full text-label md:max-w-xl">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-caption text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn("pb-1 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-border">
              <td className="py-1.5">{r[0]}</td>
              {r.slice(1).map((c, i) => (
                <td key={i} className="py-1.5 text-right font-mono">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// Thin bars on one count axis. Bar width follows the number of days; the 2px
// gap keeps neighbours apart. A wider transparent rect is the hover target
// and carries the tooltip text.
function DailyBars({ points, label, W }: { points: { date: string; count: number }[]; label: string; W: number }) {
  const H = 180;
  const left = 28;
  const bottom = 22;
  const top = 8;
  const max = Math.max(1, ...points.map((p) => p.count));
  const niceMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const step = (W - left) / points.length;
  const bw = Math.min(14, Math.max(3, step - 4));
  const y = (n: number) => top + (H - top - bottom) * (1 - n / niceMax);
  const ticks = [0, niceMax / 2, niceMax].filter((t, i, a) => a.indexOf(t) === i);
  const labelAt = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart of ${label} per day. The table view has the numbers.`} className="mt-3 h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}
      {points.map((p, i) => {
        const x = left + i * step + step / 2;
        const h = (H - top - bottom) * (p.count / niceMax);
        return (
          <g key={p.date}>
            <title>{`${formatShortDate(p.date)}: ${p.count} ${label}`}</title>
            {p.count > 0 && <rect x={x - bw / 2} y={H - bottom - h} width={bw} height={h} rx={Math.min(4, bw / 2)} fill="var(--chart-3)" />}
            <rect x={x - step / 2} y={top} width={step} height={H - top - bottom} fill="transparent" />
            {labelAt.has(i) && (
              <text x={x} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
                {formatShortDate(p.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
