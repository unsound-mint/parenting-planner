import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatShortDate } from "@/lib/format";
import { PRODUCT_NAME } from "@/lib/product";
import { SiteFooter } from "@/components/shell/site-footer";
import type { GuidanceSource } from "@/lib/api/types";

type Topic = GuidanceSource["topic"];

export const metadata: Metadata = { title: "How we check health guidance" };

const topicLabel: Record<Topic, string> = {
  pregnancy: "Pregnancy and birth",
  newborn: "Newborn and recovery",
  child: "Growing child",
  nutrition: "Food and feeding",
  mental_health: "Mental health",
  family: "Family life, rights and money",
};

// Public, like the guidelines it lists: cards speak in our own words and every
// source behind them is listed here, once, with the date we last checked it.
export default function SourcesPage() {
  return (
    <main className="mx-auto flex w-full max-w-page flex-1 flex-col gap-10 px-4 pt-6 pb-10 md:px-8">
      <header className="flex items-center justify-between">
        <Link
          href="/family"
          className="inline-flex min-h-11 items-center gap-2 text-label text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-4.5" aria-hidden />
          Back to your family
        </Link>
        <span className="text-label font-semibold tracking-tight">{PRODUCT_NAME}</span>
      </header>

      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-headline md:text-display text-balance">We stand behind every word.</h1>
        <p className="text-body text-muted-foreground">
          We write the guidance in {PRODUCT_NAME} ourselves and check each piece against current clinical guidelines from
          health services and medical bodies. That is why the cards do not cite anyone: what they say is ours, and we
          answer for it.
        </p>
        <ul className="flex flex-col gap-2 text-body">
          <li>We never diagnose. A card can tell you what is usual and when to ask, never what you have.</li>
          <li>Urgent symptoms and crisis help open fixed screens that we wrote and checked, never generated text.</li>
          <li>We recheck a guideline when it changes, and the date beside each source below is the last time we did.</li>
        </ul>
      </section>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" aria-busy />}>
        <SourceList />
      </Suspense>

      <SiteFooter className="mt-auto" />
    </main>
  );
}

async function SourceList() {
  const api = await serverApi();
  const { data } = await api.GET("/guidance-sources");
  const items = data?.items ?? [];
  if (items.length === 0) return <p className="text-body text-muted-foreground">The list of sources could not load. Try again in a moment.</p>;
  const groups = (Object.keys(topicLabel) as Topic[])
    .map((topic) => ({ topic, items: items.filter((s) => s.topic === topic) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-10">
      <p className="text-label font-normal text-muted-foreground">
        <span className="font-mono">{items.length}</span> guidelines and reference pages, grouped by topic.
      </p>
      {groups.map((g) => (
        <section key={g.topic} aria-labelledby={`topic-${g.topic}`} className="flex flex-col gap-3">
          <h2 id={`topic-${g.topic}`} className="text-title">
            {topicLabel[g.topic]} <span className="font-mono text-label font-normal text-muted-foreground">{g.items.length}</span>
          </h2>
          <ul className="gap-x-10 md:columns-2 2xl:columns-3">
            {g.items.map((s) => (
              <li key={s.url} className="mb-2.5 break-inside-avoid text-label font-normal">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline decoration-line-2 underline-offset-3 transition-colors duration-150 hover:decoration-current"
                >
                  {s.title}
                </a>
                <span className="block text-caption text-muted-foreground">
                  {s.organization} · checked <span className="font-mono">{formatShortDate(s.checkedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
