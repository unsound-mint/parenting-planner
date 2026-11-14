import Link from "next/link";
import { ArrowRight, FileCheck2, PartyPopper } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatShortDate } from "@/lib/format";
import { SoftCard } from "@/components/joy/soft-card";
import { daysFrom, leftWords } from "./days";

/**
 * "Next paperwork step": one card for This week. It reads the family paperwork hub,
 * shows the first open step with its date, and links to the hub. Renders nothing for
 * a caregiver (the API answers 404). Call it inside <Suspense>, like any API read.
 *
 *   <Suspense><NextPaperworkCard memberId={memberId} /></Suspense>
 */
export async function NextPaperworkCard({ memberId }: { memberId: string }) {
  const api = await serverApi();
  const { data } = await api.GET("/members/{memberId}/family-paperwork", { params: { path: { memberId } } });
  if (!data || data.items.length === 0) return null;
  const next = data.items.find((i) => !i.task.done);
  const left = data.items.filter((i) => !i.task.done).length;
  const days = next?.task.dueOn ? daysFrom(data.today, next.task.dueOn) : undefined;
  return (
    <SoftCard as="section" tone={next ? "plain" : "leaf"} aria-label="Next paperwork step" className="p-4.5 md:p-5">
      <Link href={`/family/${memberId}/paperwork`} className="press group flex items-center gap-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sun">
          {next ? <FileCheck2 aria-hidden className="size-6" strokeWidth={1.7} /> : <PartyPopper aria-hidden className="size-6" strokeWidth={1.7} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-caption tracking-wide text-muted-foreground uppercase">Next paperwork step</span>
          <span className="block text-title">{next ? next.task.title : "All paperwork steps are ticked"}</span>
          {next && (
            <span className="block text-label text-muted-foreground">
              {next.task.dueOn && days !== undefined && next.basis !== "anytime" ? (
                <>
                  <span className="font-mono">{formatShortDate(next.task.dueOn)}</span> · {leftWords(days)}
                  {next.basis === "suggested" && " (our suggestion)"}
                </>
              ) : (
                "No deadline"
              )}
              {left > 1 && ` · ${left - 1} more after it`}
            </span>
          )}
        </span>
        <ArrowRight aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
      </Link>
    </SoftCard>
  );
}
