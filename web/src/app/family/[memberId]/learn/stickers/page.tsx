import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { countWord } from "@/lib/format";
import { Rise } from "@/components/joy/rise";
import { PageFrame } from "@/components/shell/page";
import { StickerBookView } from "@/components/missions/sticker-book";

// The sticker book: stickers for finished lessons and paths, missions and
// practice, and for finishing a path together. No points, ranks or streaks, and
// none for anything about health. Open slots say what earns them.
export default function StickersPage({ params }: PageProps<"/family/[memberId]/learn/stickers">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Stickers params={params} />
    </Suspense>
  );
}

async function Stickers({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const { data, response } = await api.GET("/members/{memberId}/stickers", { params: { path: { memberId } } });
  if (response.status === 401) redirect("/");
  if (!data) notFound();
  const earned = data.items.filter((s) => s.earned).length;

  return (
    <PageFrame className="gap-8">
      <Rise as="header" i={0}>
        <Link href={`/family/${memberId}/learn`} className="mb-2 inline-flex min-h-11 items-center gap-1 text-label text-muted-foreground hover:text-ink md:min-h-0">
          <ChevronLeft aria-hidden className="size-4" />
          Learn
        </Link>
        <h1 className="text-headline">Your sticker book</h1>
        <p className="mt-1.5 max-w-prose text-body text-ink-2">
          {earned > 0 ? `${countWord(earned)} ${earned === 1 ? "sticker" : "stickers"} so far. ` : ""}Stickers for the things you finish, alone or together. There is no rush and nothing to lose.
        </p>
      </Rise>
      <Rise i={1}>
        <StickerBookView items={data.items} memberId={memberId} />
      </Rise>
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 grid grid-cols-3 gap-6 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="size-24 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
    </main>
  );
}
