"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import type { GrowthMeasurementInput, GrowthPoint } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { passportIcon } from "@/lib/visuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "./section-card";

type Metric = "weightKg" | "heightCm" | "headCm";
const metrics: Record<Metric, { label: string; unit: string }> = {
  weightKg: { label: "Weight", unit: "kg" },
  heightCm: { label: "Length", unit: "cm" },
  headCm: { label: "Head", unit: "cm" },
};
const WHO = "https://www.who.int/tools/child-growth-standards";

const ageWords = (months: number) => (months === 0 ? "newborn" : months < 24 ? `${months} mo` : `${Math.floor(months / 12)} y`);

const W = 480;
const H = 180;
const PAD = { l: 40, r: 16, t: 20, b: 30 };

// One measure over the visits, on a date axis so uneven gaps between visits stay honest.
function Chart({ points, metric }: { points: GrowthPoint[]; metric: Metric }) {
  const pts = points.filter((p) => p[metric] != null).map((p) => ({ t: Date.parse(p.measuredOn), v: p[metric] as number, p }));
  if (pts.length === 0) return <p className="py-8 text-center text-label text-muted-foreground">No {metrics[metric].label.toLowerCase()} recorded yet.</p>;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const pad = (max - min) * 0.15 || max * 0.05;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const x = (t: number) => PAD.l + (t1 === t0 ? (W - PAD.l - PAD.r) / 2 : ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  const { unit, label } = metrics[metric];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label} over time: ${pts.map((p) => `${p.v} ${unit} on ${formatShortDate(p.p.measuredOn)}`).join(", ")}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth="1" />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[11px]">
            {v.toFixed(metric === "weightKg" ? 1 : 0)}
          </text>
        </g>
      ))}
      <polyline points={pts.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")} fill="none" className="stroke-status-ok" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={p.p.id}>
          <circle cx={x(p.t)} cy={y(p.v)} r={i === pts.length - 1 ? 5.5 : 4} className="fill-status-ok stroke-card" strokeWidth="2" />
          <text x={x(p.t)} y={y(p.v) - 10} textAnchor="middle" className="fill-foreground font-mono text-[11px] font-semibold">
            {p.v}
          </text>
          <text x={x(p.t)} y={H - 8} textAnchor={pts.length > 1 && i === 0 ? "start" : pts.length > 1 && i === pts.length - 1 ? "end" : "middle"} className="fill-muted-foreground font-mono text-[11px]">
            {ageWords(p.p.ageMonths)}
          </text>
        </g>
      ))}
    </svg>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

function MeasurementForm({ memberId, childId, point, onDone }: { memberId: string; childId: string; point?: GrowthPoint; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [on, setOn] = useState(point?.measuredOn ?? today());
  const [kg, setKg] = useState(point ? String(point.weightKg) : "");
  const [cm, setCm] = useState(point ? String(point.heightCm) : "");
  const [head, setHead] = useState(point?.headCm != null ? String(point.headCm) : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: GrowthMeasurementInput = { childId, measuredOn: on, weightKg: Number(kg), heightCm: Number(cm) };
    if (head) body.headCm = Number(head);
    startTransition(async () => {
      const res = point
        ? await api.PATCH("/members/{memberId}/growth-measurements/{measurementId}", { params: { path: { memberId, measurementId: point.id } }, body })
        : await api.POST("/members/{memberId}/growth-measurements", { params: { path: { memberId } }, body });
      if (res.error) {
        toast.error(res.response.status === 400 ? "Check the date and the numbers: weight in kg, length and head in cm." : "Could not save. Please try again.");
        return;
      }
      toast.success(point ? "Measurement updated" : "Measurement added");
      onDone();
      router.refresh();
    });
  }

  function remove() {
    if (!point) return;
    startTransition(async () => {
      const { error } = await api.DELETE("/members/{memberId}/growth-measurements/{measurementId}", { params: { path: { memberId, measurementId: point.id } } });
      if (error) {
        toast.error("Could not remove it. Please try again.");
        return;
      }
      toast(`Measurement from ${formatShortDate(point.measuredOn)} removed`);
      onDone();
      router.refresh();
    });
  }

  const num = "h-11 rounded-xl bg-card px-3 font-mono text-body";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4" aria-label={point ? "Edit measurement" : "Add a measurement"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="g-on">Date of the visit</Label>
          <Input id="g-on" type="date" required max={today()} value={on} onChange={(e) => setOn(e.target.value)} className={num} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-kg">Weight, kg</Label>
          <Input id="g-kg" type="number" inputMode="decimal" step="0.01" min={0.3} max={80} required value={kg} onChange={(e) => setKg(e.target.value)} placeholder="4.6" className={num} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-cm">Length, cm</Label>
          <Input id="g-cm" type="number" inputMode="decimal" step="0.1" min={20} max={200} required value={cm} onChange={(e) => setCm(e.target.value)} placeholder="55" className={num} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-head">Head, cm (optional)</Label>
          <Input id="g-head" type="number" inputMode="decimal" step="0.1" min={20} max={65} value={head} onChange={(e) => setHead(e.target.value)} placeholder="37.5" className={num} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending} className="press h-11 rounded-full px-5 text-label">
          {point ? "Save changes" : "Add measurement"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onDone} className="press h-11 rounded-full px-4 text-label">
          Cancel
        </Button>
        {point && (
          <Button type="button" variant="ghost" disabled={pending} onClick={remove} className="press ml-auto h-11 gap-2 rounded-full px-4 text-label text-muted-foreground hover:text-foreground">
            <Trash2 aria-hidden className="size-4" />
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Child only. Weight, length and head size from each checkup, drawn over time,
 * with a form to add, correct or remove a visit. Percentiles are left to the
 * pediatrician: the WHO standards depend on sex, which the app does not store.
 */
export function GrowthCard({ growth, memberId, childId, name, canEdit }: { growth: GrowthPoint[]; memberId: string; childId: string; name: string; canEdit: boolean }) {
  const last = growth[growth.length - 1];
  const [metric, setMetric] = useState<Metric>("weightKg");
  const [editing, setEditing] = useState<string | null>(null);
  const hasHead = growth.some((g) => g.headCm != null);
  const shown = metric === "headCm" && !hasHead ? "weightKg" : metric;

  return (
    <SectionCard
      id="growth-title"
      icon={passportIcon.growth}
      title="Growth"
      figure={
        canEdit &&
        last &&
        editing !== "new" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-label font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9"
          >
            <Plus aria-hidden className="size-4" />
            Add a visit
          </button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {editing === "new" && <MeasurementForm memberId={memberId} childId={childId} onDone={() => setEditing(null)} />}

        {!last ? (
          editing !== "new" && (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-2 p-4">
              <p className="text-body text-ink-2">
                Write down {name}&apos;s weight, length and head size after each checkup and the curve grows here. Your pediatrician compares them with the{" "}
                <a href={WHO} target="_blank" rel="noreferrer" className="underline decoration-line-2 underline-offset-3 hover:text-foreground">
                  WHO growth standards
                </a>
                , so ask them what the numbers mean for {name}.
              </p>
              {canEdit && (
                <Button type="button" onClick={() => setEditing("new")} className="press h-11 gap-2 rounded-full px-5 text-label">
                  <Plus aria-hidden className="size-4" />
                  Add the first measurement
                </Button>
              )}
            </div>
          )
        ) : (
          <>
            <div role="radiogroup" aria-label="Measure" className="flex gap-1 self-start rounded-xl bg-muted p-1">
              {(Object.keys(metrics) as Metric[])
                .filter((m) => m !== "headCm" || hasHead)
                .map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={shown === m}
                    onClick={() => setMetric(m)}
                    className={cn(
                      "min-h-9 rounded-lg px-3 text-label transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      shown === m ? "bg-card font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {metrics[m].label}
                  </button>
                ))}
            </div>
            <Chart points={growth} metric={shown} />
            <ul className="flex flex-col divide-y divide-line">
              {[...growth].reverse().map((g) =>
                editing === g.id ? (
                  <li key={g.id} className="py-2">
                    <MeasurementForm memberId={memberId} childId={childId} point={g} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <li key={g.id} className="flex min-h-11 items-center gap-3 py-1.5 text-label">
                    <span className="w-24 shrink-0">
                      <span className="font-mono">{formatShortDate(g.measuredOn)}</span>
                      <span className="block text-caption text-muted-foreground">{ageWords(g.ageMonths)}</span>
                    </span>
                    <span className="flex-1 font-mono text-ink-2 tabular-nums">
                      {g.weightKg} kg · {g.heightCm} cm{g.headCm != null ? ` · head ${g.headCm}` : ""}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditing(g.id)}
                        aria-label={`Edit the measurement from ${formatShortDate(g.measuredOn)}`}
                        className="press flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil aria-hidden className="size-4" />
                      </button>
                    )}
                  </li>
                ),
              )}
            </ul>
          </>
        )}
      </div>
    </SectionCard>
  );
}
