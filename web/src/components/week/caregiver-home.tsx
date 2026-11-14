import { Baby, CalendarHeart, Lock, type LucideIcon } from "lucide-react";
import type { Caregiver, Family, Guide, PregnancyWeek, Today } from "@/lib/api/types";
import { Suspense } from "react";
import { CaregiverTodaySlot, GuidesSlot, type Pending } from "@/components/today/slots";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { familyNow } from "@/lib/clock";
import { CaregiverHero } from "./hero";
import { PageFrame, PageGrid } from "@/components/shell/page";
import { roleLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// Home for a grandparent or nanny. They see the baby's care, never a parent's
// health data (CaregiverRole in api/openapi.yaml). The hero shows the baby
// (its size when the week card is readable for this role), then today's care
// and guides, then what this view shows and what it keeps private.
export function CaregiverHome({
  family,
  caregiver,
  today,
  guides,
  card,
}: {
  family: Family;
  caregiver: Caregiver;
  today?: Pending<Today>;
  guides?: Pending<{ items: Guide[] }>;
  card?: Pending<PregnancyWeek>;
}) {
  const names = Object.fromEntries([...family.parents, ...(family.caregivers ?? [])].map((p) => [p.id, p.displayName]));
  const expecting = family.stage === "pregnancy";
  const context = `${roleLabel[caregiver.role]} view`;
  const now = familyNow(family);
  const hero = (c?: PregnancyWeek) => <CaregiverHero family={family} name={caregiver.displayName} card={c} context={context} now={now} />;

  return (
    <PageFrame className="gap-6 @4xl:gap-8">
      <Rise i={0}>
        <Suspense fallback={hero()}>
          <HeroWithCard card={card} render={hero} />
        </Suspense>
      </Rise>

      {/* Each slot renders nothing until its endpoint has data, so an empty grid hides. */}
      <PageGrid className="rise empty:hidden" style={{ "--i": 1 } as React.CSSProperties}>
        <CaregiverTodaySlot today={today} names={names} />
        <GuidesSlot guides={guides} />
      </PageGrid>

      <Rise i={2} as="section" aria-labelledby="sees" className="grid gap-4.5 @2xl:grid-cols-2">
        <h2 id="sees" className="sr-only">
          What you can see
        </h2>
        <Access
          icon={expecting ? CalendarHeart : Baby}
          tone="leaf"
          title="What you can see"
          text={
            expecting
              ? "The baby's care as it takes shape: visits, preparations and what the parents share with the family."
              : "The baby's care: schedule, feeding, sleep, visits and milestones, and what the parents share with the family."
          }
        />
        <Access icon={Lock} tone="plain" title="What stays private" text="Parents' health records, mood check-ins and diaries. They are never shown in this view." />
      </Rise>
    </PageFrame>
  );
}

async function HeroWithCard({ card, render }: { card?: Pending<PregnancyWeek>; render: (c?: PregnancyWeek) => React.ReactNode }) {
  return render(await card);
}

function Access({ icon: Icon, tone, title, text }: { icon: LucideIcon; tone: "leaf" | "plain"; title: string; text: string }) {
  return (
    <SoftCard tone={tone} className="flex gap-4">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone === "leaf" ? "bg-card/70 text-leaf" : "bg-muted text-ink-2")}>
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-title">{title}</h3>
        <p className="mt-1 text-body text-ink-2">{text}</p>
      </div>
    </SoftCard>
  );
}
