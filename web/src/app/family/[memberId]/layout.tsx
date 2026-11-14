import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyContext } from "@/lib/format";
import { PRODUCT_NAME } from "@/lib/product";
import { FamilyNav } from "@/components/shell/family-nav";
import { ParentSwitch } from "@/components/shell/parent-switch";
import { UrgentHelpLink } from "@/components/shell/urgent-help-link";

// Frame for every family screen: navigation, the parent switch and the urgent
// help entry, which must stay visible on every screen (docs/design.md, rule 5).
export default function FamilyLayout({ children, params }: LayoutProps<"/family/[memberId]">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children, params }: { children: React.ReactNode; params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401 || !family) redirect("/");
  const parent = family.parents.find((p) => p.id === memberId);
  if (!parent) notFound();

  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card px-4 py-4 md:w-56 md:border-r md:border-b-0 md:py-6">
        <div className="flex items-center justify-between gap-3 md:block">
          <p className="px-2 text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
          <div className="md:hidden">
            <UrgentHelpLink />
          </div>
        </div>
        <FamilyNav memberId={memberId} />
        <div className="mt-auto hidden rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground md:block">
          <p className="font-medium text-foreground">Demo family</p>
          <p>Synthetic data, your own copy. Changes stay in this browser session.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 px-4 pt-5 md:px-8">
          <ParentSwitch parents={family.parents} memberId={memberId} />
          <span className="flex-1" />
          <span className="inline-flex h-6 items-center rounded-full bg-status-due-soft px-2.5 text-caption font-medium text-status-due">
            Demo data
          </span>
          <Link href="/pricing" className="text-label text-muted-foreground transition-colors duration-150 hover:text-foreground">
            Plans
          </Link>
          <span className="hidden text-label font-normal text-muted-foreground sm:inline">{familyContext(family)}</span>
          <div className="hidden md:block">
            <UrgentHelpLink />
          </div>
        </header>
        <ViewTransition>{children}</ViewTransition>
      </div>
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden w-56 border-r border-border bg-card md:block" />
      <p className="p-10 text-muted-foreground">Opening your family...</p>
    </div>
  );
}
