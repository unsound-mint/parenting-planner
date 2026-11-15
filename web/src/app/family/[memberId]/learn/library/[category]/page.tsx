import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/shell/page";
import { TopicGroups } from "@/components/library/topic-groups";
import { loadCatalogue } from "../load";

// One topic of the Learn library in full, grouped by stage with counts.
export default function LibraryTopicPage({ params }: PageProps<"/family/[memberId]/learn/library/[category]">) {
  return (
    <Suspense fallback={<main className="flex-1 px-4 pt-6 md:px-8" aria-busy><div className="h-96 animate-pulse rounded-3xl bg-muted" /></main>}>
      <Topic params={params} />
    </Suspense>
  );
}

async function Topic({ params }: { params: Promise<{ memberId: string; category: string }> }) {
  const { memberId, category } = await params;
  const { items, stage } = await loadCatalogue(memberId);
  const cat = decodeURIComponent(category);
  const list = items.filter((i) => i.category === cat);
  if (list.length === 0) notFound();
  return (
    <PageFrame className="gap-8">
      <TopicGroups key={`${memberId}-${cat}`} memberId={memberId} category={cat} items={list} stage={stage} />
    </PageFrame>
  );
}
