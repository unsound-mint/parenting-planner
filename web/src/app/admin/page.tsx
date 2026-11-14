import { Suspense } from "react";
import Link from "next/link";
import { BarChart3, FileText, Handshake, Info, WifiOff } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import type { ContentKind } from "@/lib/api/types";
import { ContentEditor } from "@/components/admin/content-editor";
import { OffersAdmin } from "@/components/admin/offers-admin";
import { AnalyticsView } from "@/components/admin/analytics-view";
import { contentKinds } from "@/components/admin/labels";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "content", label: "Content", icon: FileText },
  { id: "offers", label: "Offers", icon: Handshake },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;
type Tab = (typeof tabs)[number]["id"];

// Demo admin: edit the content of your own demo copy, manage partner offers
// and read usage counts. Tabs are search params (?tab=offers) so each is a link.
export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="flex flex-1 flex-col pt-6">
      <Suspense fallback={<Fallback />}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Admin({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const tab: Tab = tabs.find((t) => t.id === pick(sp.tab))?.id ?? "content";
  const kind: ContentKind = contentKinds.find((k) => k.id === pick(sp.kind))?.id ?? "pregnancy_week";
  const days = [7, 14, 30].find((d) => String(d) === pick(sp.days)) ?? 14;

  return (
    <>
      <h1 className="text-headline text-balance">{headlines[tab]}</h1>
      <p className="mt-2 flex items-center gap-2 text-label font-normal text-muted-foreground">
        <Info className="size-4 shrink-0" aria-hidden />
        {tab === "analytics" ? "Counts across all demo families. No names, no health records." : "Changes only affect your demo copy. Nobody else sees them."}
      </p>

      <nav aria-label="Admin sections" className="mt-6 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-label transition-colors duration-150",
              t.id === tab ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "content" && <Content kind={kind} />}
        {tab === "offers" && <Offers />}
        {tab === "analytics" && <Analytics days={days} />}
      </div>
    </>
  );
}

const headlines: Record<Tab, string> = {
  content: "Edit what your demo family reads.",
  offers: "Choose which partner offers parents see.",
  analytics: "How the demo is being used.",
};

async function Content({ kind }: { kind: ContentKind }) {
  const api = await serverApi();
  const { data } = await api.GET("/admin/content-items", { params: { query: { kind } } });
  return (
    <>
      <nav aria-label="Content type" className="flex flex-wrap gap-2">
        {contentKinds.map((k) => (
          <Link
            key={k.id}
            href={`/admin?tab=content&kind=${k.id}`}
            aria-current={k.id === kind ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label transition-colors duration-150 md:min-h-9",
              k.id === kind ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <k.icon className="size-4" aria-hidden />
            {k.label}
          </Link>
        ))}
      </nav>
      {data ? <ContentEditor key={kind} initial={data.items} /> : <Failed what="the content" />}
    </>
  );
}

async function Offers() {
  const api = await serverApi();
  const { data } = await api.GET("/admin/partner-offers");
  return data ? <OffersAdmin initial={data.items} /> : <Failed what="the offers" />;
}

async function Analytics({ days }: { days: number }) {
  const api = await serverApi();
  const { data } = await api.GET("/admin/analytics", { params: { query: { days } } });
  return data ? <AnalyticsView data={data} days={days} /> : <Failed what="the numbers" />;
}

function Failed({ what }: { what: string }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <WifiOff className="size-5" aria-hidden />
      </span>
      <p className="text-title">We could not load {what}.</p>
      <p className="text-label text-muted-foreground">Nothing is changed. Try again in a moment, or start the demo first.</p>
    </div>
  );
}

function Fallback() {
  return (
    <div aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 h-11 w-full animate-pulse rounded bg-muted" />
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
