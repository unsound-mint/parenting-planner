import type { LabResult } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { labPosition } from "./summary";

// Reference range drawn as a band on a track, the value as a marker. The track
// extends half a range past each end so a value outside the band is visibly outside.
// Outside the range is ochre ("worth asking about"), never red.
export function RangeBar({ lab }: { lab: LabResult }) {
  const { refLow, refHigh, value } = lab;
  const pos = labPosition(lab);
  if (pos === "unknown") return <div className="h-2 rounded-full bg-muted" aria-hidden />;

  const low = refLow ?? 0;
  const high = refHigh ?? Math.max(value, low) * 1.5;
  const pad = (high - low) / 2 || 1;
  const min = refLow == null ? 0 : low - pad;
  const max = refHigh == null ? Math.max(value * 1.2, low + pad * 2) : high + pad;
  const at = (n: number) => Math.min(100, Math.max(0, ((n - min) / (max - min)) * 100));
  const bandStart = refLow == null ? 0 : at(low);
  const bandEnd = refHigh == null ? 100 : at(high);

  return (
    <div className="relative h-2 rounded-full bg-muted" aria-hidden>
      <span className="absolute inset-y-0 rounded-full bg-status-ok/25" style={{ left: `${bandStart}%`, width: `${bandEnd - bandStart}%` }} />
      <span
        className={cn(
          "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card",
          pos === "in" ? "bg-status-ok" : "bg-status-due",
        )}
        style={{ left: `${at(value)}%` }}
      />
    </div>
  );
}
