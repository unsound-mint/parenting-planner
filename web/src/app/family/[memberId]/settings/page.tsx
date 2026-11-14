import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { inLossSupport } from "@/lib/loss";
import { PREGNANCY_LOSS_ENABLED } from "@/lib/features";
import { stageLabel } from "@/lib/format";
import { StageControl } from "@/components/today/stage-control";
import { Compass } from "lucide-react";
import { JourneyPreferences } from "@/components/fertility/journey-preferences";
import { getJourneySettings } from "@/lib/journey-settings";
import { Card, NotificationsCard, StageCard } from "@/components/settings/privacy-cards";
import { PageFrame, PageGrid } from "@/components/shell/page";

// Settings for the person acting: the stage and due date (parents) and what the
// notification bell holds. Who sees what is on the Privacy screen.
export default function SettingsPage({ params }: PageProps<"/family/[memberId]/settings">) {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) redirect("/");
  const me = family && familyPeople(family).find((p) => p.id === memberId);
  // A person from another family (an old tab after a new session): open the current family.
  if (family && !me) redirect("/family");
  if (!family || !me) notFound();
  const caregiver = isCaregiver(me.role);
  const { data: notifications } = await api.GET("/members/{memberId}/notifications", { params: { path: { memberId } } });
  const journey = caregiver ? undefined : await getJourneySettings(memberId);
  const loss = inLossSupport(family);

  return (
    <PageFrame>
      <header>
        <h1 className="max-w-2xl text-headline text-balance">Settings</h1>
      </header>
      <PageGrid cols={3}>
        {!caregiver && (
          <StageCard family={loss ? { stage: family.stage } : family}>
            {loss ? (
              <span className="text-label font-medium">{stageLabel[family.stage]}</span>
            ) : (
              <StageControl memberId={memberId} stage={family.stage} dueDate={family.dueDate} hasChild={family.children.length > 0} lossEntry={PREGNANCY_LOSS_ENABLED} />
            )}
          </StageCard>
        )}
        {journey && (
          <Card title="Your journey" icon={Compass}>
            <JourneyPreferences memberId={memberId} initial={journey} showTrying={family.stage === "planning" || family.stage === "trying"} />
          </Card>
        )}
        {notifications && <NotificationsCard list={notifications} />}
      </PageGrid>
    </PageFrame>
  );
}

function SettingsFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    </main>
  );
}
