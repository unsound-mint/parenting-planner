import type { LucideIcon } from "lucide-react";
import { passportIcon } from "@/lib/visuals";
import type { Tally } from "./summary";
import { Ring, type RingSegment } from "./ring";

function Gauge({
  icon: Icon,
  title,
  segments,
  total,
  figure,
  caption,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  segments: RingSegment[];
  total: number;
  figure: string;
  caption: string;
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <Ring segments={segments} total={total} label={total > 0 ? `${title}: ${caption}` : empty}>
        {total > 0 ? <span className="font-mono text-title tabular-nums">{figure}</span> : <Icon className="size-5 text-muted-foreground" aria-hidden />}
      </Ring>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-body font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </p>
        <p className="text-label text-muted-foreground">{total > 0 ? caption : empty}</p>
      </div>
    </div>
  );
}

// First read: where this person stands, drawn. Vaccines and labs as rings; what
// to do about the open slice lives in the next step, so no "due" wording here.
export function SummaryCard({ tally: t }: { tally: Tally }) {
  return (
    <section aria-label="Summary" className="grid grid-cols-2 items-center gap-4 rounded-2xl sm:flex sm:gap-x-10 border border-border bg-card p-5">
      <Gauge
        icon={passportIcon.vaccines}
        title="Vaccines"
        total={t.vaccinesTotal}
        segments={[
          { value: t.vaccinesGiven, className: "text-status-ok" },
          { value: t.vaccinesOverdue, className: "text-status-late" },
          { value: t.vaccinesNeeded, className: "text-status-due" },
        ]}
        figure={`${t.vaccinesGiven}/${t.vaccinesTotal}`}
        caption={`${t.vaccinesGiven} of ${t.vaccinesTotal} given`}
        empty="None on file"
      />
      <Gauge
        icon={passportIcon.labs}
        title="Labs"
        total={t.labsTotal}
        segments={[
          { value: t.labsIn, className: "text-status-ok" },
          { value: t.labsOutside, className: "text-status-due" },
        ]}
        figure={`${t.labsIn}/${t.labsTotal}`}
        caption={`${t.labsIn} of ${t.labsTotal} in range`}
        empty="None on file"
      />
    </section>
  );
}
