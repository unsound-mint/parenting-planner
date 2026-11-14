import { Baby, CalendarHeart, Lock, type LucideIcon } from "lucide-react";
import type { Caregiver, Family, Guide, PregnancyWeek, Today } from "@/lib/api/types";
import { CaregiverTodaySlot, GuidesSlot, WeekCardSlot, type Pending } from "@/components/today/slots";
import { PageFrame, PageGrid } from "@/components/shell/page";
import { familyContext } from "@/lib/format";
import { roleAccent, roleLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// Home for a grandparent or nanny. They see the baby's care, never a parent's
// health data (CaregiverRole in api/openapi.yaml). Everything here is read from
// the family; the care schedule itself lands with its API.
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
  const child = family.children[0];
  const expecting = family.stage === "pregnancy";
  const headline = expecting
    ? `Hello, ${caregiver.displayName}. The baby is on the way.`
    : child
      ? `Hello, ${caregiver.displayName}. Here is ${child.name}'s care.`
      : `Hello, ${caregiver.displayName}.`;

  return (
    <PageFrame className="gap-8">
      <header>
        <h1 className="text-headline text-balance">{headline}</h1>
        <p className="mt-2 text-label font-normal text-muted-foreground">
          {roleLabel[caregiver.role]} view · {familyContext(family)}
        </p>
      </header>

      <PageGrid cols={3}>
        <CaregiverTodaySlot today={today} names={names} />
        <WeekCardSlot card={card} />
        <GuidesSlot guides={guides} />
      </PageGrid>

      <section aria-labelledby="sees" className="grid gap-3 sm:grid-cols-2">
        <h2 id="sees" className="sr-only">
          What you can see
        </h2>
        <Access
          icon={expecting ? CalendarHeart : Baby}
          tone={roleAccent[caregiver.role].text}
          title="What you can see"
          text={
            expecting
              ? "The baby's care as it takes shape: visits, preparations and what the parents share with the family."
              : "The baby's care: schedule, feeding, sleep, visits and milestones, and what the parents share with the family."
          }
        />
        <Access
          icon={Lock}
          tone="text-muted-foreground"
          title="What stays private"
          text="Parents' health records, mood check-ins and diaries. They are never shown in this view."
        />
      </section>
    </PageFrame>
  );
}

function Access({
  icon: Icon,
  tone,
  title,
  text,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-muted", tone)}>
        <Icon aria-hidden className="size-4.5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-title">{title}</h3>
        <p className="mt-1 text-body text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
