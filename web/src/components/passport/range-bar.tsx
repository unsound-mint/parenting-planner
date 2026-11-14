import type { LabResult } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { labPosition } from "./summary";

// Reference range drawn as a band on a track, the value as a marker. The track
// extends half a range past each end so a value outside the band is visibly outside.
// Outside the range is ochre ("worth asking about"), never red. With `ends`, the
// range limits are printed under the band edges.
export function RangeBar({ lab, ends = false }: { lab: LabResult; ends?: boolean }) {
  const { refLow, refHigh, value } = lab;
  const pos = labPosition(lab);
  if (pos === "unknown") return <div className="h-2.5 rounded-full bg-muted" aria-hidden />;

  const low = refLow ?? 0;
  const high = refHigh ?? Math.max(value, low) * 1.5;
  const pad = (high - low) / 2 || 1;
  const min = refLow == null ? 0 : low - pad;
  const max = refHigh == null ? Math.max(value * 1.2, low + pad * 2) : high + pad;
  const at = (n: number) => Math.min(100, Math.max(0, ((n - min) / (max - min)) * 100));
  const bandStart = refLow == null ? 0 : at(low);
  const bandEnd = refHigh == null ? 100 : at(high);

  return (
    <div className={cn("relative", ends && "pb-5")} aria-hidden>
      <div className="relative h-2.5 rounded-full bg-muted">
        <span className="absolute inset-y-0 rounded-full bg-status-ok/25" style={{ left: `${bandStart}%`, width: `${bandEnd - bandStart}%` }} />
        <span
          className={cn(
            "absolute top-1/2 size-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card shadow-[0_0_0_1px_rgb(0_0_0/0.12)]",
            pos === "in" ? "bg-status-ok" : "bg-status-due",
          )}
          style={{ left: `${at(value)}%` }}
        />
      </div>
      {ends && refLow != null && (
        <span className="absolute bottom-0 -translate-x-1/2 font-mono text-caption text-muted-foreground" style={{ left: `${bandStart}%` }}>
          {refLow}
        </span>
      )}
      {ends && refHigh != null && (
        <span className="absolute bottom-0 -translate-x-1/2 font-mono text-caption text-muted-foreground" style={{ left: `${bandEnd}%` }}>
          {refHigh}
        </span>
      )}
    </div>
  );
}
