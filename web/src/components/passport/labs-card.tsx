import type { LabResult } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { passportIcon, visibilityIcon, visibilityLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
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
            const Lock = visibilityIcon[lab.visibility];
            return (
              <li key={lab.id} className="grid gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-body font-medium">
                    {lab.name}
                    {showVisibility && (
                      <span title={visibilityLabel[lab.visibility]} className="text-muted-foreground">
                        <Lock className="size-3.5" aria-hidden />
                        <span className="sr-only">{visibilityLabel[lab.visibility]}</span>
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-caption text-muted-foreground">{formatLongDate(lab.takenOn)}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-title tabular-nums">
                      {lab.value} <span className="text-label font-normal text-muted-foreground">{lab.unit}</span>
                    </span>
                    <span className={cn("text-caption font-medium", pos === "low" || pos === "high" ? "text-status-due" : "text-muted-foreground")}>
                      {positionText[pos]}
                    </span>
                  </p>
                  <RangeBar lab={lab} />
                  {pos !== "unknown" && (
                    <p className="font-mono text-caption text-muted-foreground">
                      range {lab.refLow ?? "…"} to {lab.refHigh ?? "…"} {lab.unit}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
