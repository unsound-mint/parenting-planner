import type { PlanItemStatus } from "@/lib/api/types";
import { formatShortDate, statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

// Calm status scale (docs/design.md, rule 4). Overdue is clay, never red.
const tone: Record<PlanItemStatus, string> = {
  overdue: "bg-status-late-soft text-status-late",
  due: "bg-status-due-soft text-status-due",
  upcoming: "bg-status-up-soft text-status-up",
};

export function StatusPill({ status, dueBy, className }: { status: PlanItemStatus; dueBy?: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap", tone[status], className)}>
      {statusLabel[status]}
      {dueBy && status !== "overdue" ? ` · by ${formatShortDate(dueBy)}` : ""}
    </span>
  );
}
