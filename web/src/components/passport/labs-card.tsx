import { ArrowDown, ArrowUp } from "lucide-react";
import type { LabResult } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import { VisibilityChip } from "./visibility-chip";
import { RangeBar } from "./range-bar";
import { EmptyLine, SectionCard } from "./section-card";
import { labPosition, latestLabs } from "./summary";

const positionText = { low: "Below range", in: "In range", high: "Above range", unknown: "No range given" } as const;

export function LabsCard({ labs, showVisibility }: { labs: LabResult[]; showVisibility: boolean }) {
  const latest = latestLabs(labs);
  return (
    <SectionCard id="labs-title" icon={passportIcon.labs} title="Lab results">
      {latest.length === 0 ? (
        <EmptyLine>No lab results on file yet.</EmptyLine>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {latest.map((lab) => {
            const pos = labPosition(lab);
            const out = pos === "low" || pos === "high";
            const Arrow = pos === "low" ? ArrowDown : ArrowUp;
            return (
              <li key={lab.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body font-medium">{lab.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-caption text-muted-foreground">
                      {formatLongDate(lab.takenOn)}
                      {showVisibility && <VisibilityChip visibility={lab.visibility} />}
                    </p>
                  </div>
                  <p className="flex shrink-0 items-center gap-2">
                    {out && (
                      <span className="flex size-6 items-center justify-center rounded-full bg-status-due-soft text-status-due">
                        <Arrow className="size-3.5" aria-hidden />
                      </span>
                    )}
                    <span className="font-mono text-title tabular-nums">
                      {lab.value} <span className="text-label font-normal text-muted-foreground">{lab.unit}</span>
                    </span>
                    <span className="sr-only">{positionText[pos]}</span>
                  </p>
                </div>
                <RangeBar lab={lab} ends />
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
