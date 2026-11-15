import { Suspense } from "react";
import { PageFrame } from "@/components/shell/page";
import { LibraryShelves } from "@/components/library/library-shelves";
import { loadCatalogue } from "./load";

// The Learn library: every article, lesson and quiz on shelves by topic, with
// search and filters. Paths on Learn stay the focused "what now"; this is the
// place to browse. Coming-soon titles are listed with honest counts and never open.
export default function LibraryPage({ params }: PageProps<"/family/[memberId]/learn/library">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Library params={params} />
    </Suspense>
  );
}

async function Library({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { items, stage, position } = await loadCatalogue(memberId);
  return (
    <PageFrame className="gap-10">
      <LibraryShelves key={memberId} memberId={memberId} items={items} stage={stage} position={position} />
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-72 animate-pulse rounded-[2.25rem] bg-muted" />
      <div className="h-48 animate-pulse rounded-3xl bg-muted" />
      <div className="h-48 animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
