import type { GrowthPoint } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import { EmptyLine, SectionCard } from "./section-card";

const W = 160;
const H = 48;
const PAD = 6;

function Spark({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    PAD + (values.length === 1 ? (W - 2 * PAD) / 2 : (i / (values.length - 1)) * (W - 2 * PAD)),
    H - PAD - ((v - min) / span) * (H - 2 * PAD),
  ]);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full text-status-ok" aria-hidden>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2.5} fill="currentColor" />
      ))}
      <circle cx={last[0]} cy={last[1]} r="7" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

function Percentile({ value }: { value?: number }) {
  if (value == null) return null;
  return (
    <div className="mt-2">
      <div className="relative h-1.5 rounded-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-[3%] w-[94%] rounded-full bg-status-ok/20" />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-status-ok" style={{ left: `${value}%` }} />
      </div>
      <p className="mt-1 font-mono text-caption text-muted-foreground">{value}th percentile</p>
    </div>
  );
}

function Measure({ label, unit, values, percentile }: { label: string; unit: string; values: number[]; percentile?: number }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-label text-muted-foreground">{label}</p>
      <p className="font-mono text-title tabular-nums">
        {values[values.length - 1]} <span className="text-label font-normal text-muted-foreground">{unit}</span>
      </p>
      <Spark values={values} />
      <Percentile value={percentile} />
    </div>
  );
}

// Child only. Weight and height over visits; percentile is computed by the API.
export function GrowthCard({ growth }: { growth: GrowthPoint[] }) {
  const last = growth[growth.length - 1];
  return (
    <SectionCard
      id="growth-title"
      icon={passportIcon.growth}
      title="Growth"
      figure={last && <span className="font-mono text-caption text-muted-foreground">last visit {formatShortDate(last.measuredOn)}</span>}
    >
      {!last ? (
        <EmptyLine>No measurements yet.</EmptyLine>
      ) : (
        <div className="flex gap-6">
          <Measure label="Weight" unit="kg" values={growth.map((g) => g.weightKg)} percentile={last.weightPercentile} />
          <Measure label="Height" unit="cm" values={growth.map((g) => g.heightCm)} percentile={last.heightPercentile} />
        </div>
      )}
    </SectionCard>
  );
}
