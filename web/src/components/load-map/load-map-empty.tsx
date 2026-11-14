import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SoftCard } from "@/components/joy/soft-card";

// Shown while there is nothing to count yet. It says what the card will show
// and what fills it, with a sketch that is plainly an example (dashed, no names).
export function LoadMapEmpty({ memberId }: { memberId: string }) {
  return (
    <SoftCard as="section" aria-labelledby="load-map-title" className="flex flex-col gap-4">
      <div>
        <h2 id="load-map-title" className="text-headline">
          Who carries what
        </h2>
        <p className="mt-1 max-w-prose text-label font-normal text-muted-foreground">
          A calm picture of how the work is shared between you, by area: appointments, shopping, paperwork, the hospital bag, feeds and nights.
        </p>
      </div>
      <div aria-hidden className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-line-2 p-4">
        <p className="font-mono text-caption text-muted-foreground">Example</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-3/5 rounded-full bg-muted-foreground/40" />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/5 rounded-full bg-muted-foreground/40" />
        </div>
      </div>
      <ol className="flex max-w-prose list-decimal flex-col gap-1.5 pl-5 text-body marker:text-muted-foreground">
        <li>Add tasks to the shared plan, or take the ones your partner offers.</li>
        <li>Log feeds, diapers and night wake-ups as they happen.</li>
        <li>A thick bar then shows who is doing each area and a thin one who noticed it first. Nothing is entered by hand.</li>
      </ol>
      <Link href={`/family/${memberId}/plan`} className="press inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-primary px-5 text-label font-medium text-primary-foreground hover:bg-primary/90">
        Open the plan
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </SoftCard>
  );
}
