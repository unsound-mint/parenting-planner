import { notFound, redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { serverApi } from "@/lib/api/server";
import type { Family, PlanItem } from "@/lib/api/types";
import { countThings, familyContext } from "@/lib/format";
import { familyPeople } from "@/lib/roles";
import { categoryIcon, statusTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { BabyCard } from "@/components/baby/baby-card";
import { MilestoneCard } from "@/components/child/milestone-card";
import { VaccineTimeline } from "@/components/passport/vaccine-timeline";
import { ShiftCard } from "@/components/schedule/shift-card";
import { PageFrame, PageGrid, Stack } from "@/components/shell/page";

/**
 * The home for a child past toddler age (the "Baby" screen has feeds and diapers,
 * which a 4-year-old does not need). Three things a parent of a preschooler
 * actually does: check the milestones, keep up with vaccines and screenings, and
 * see who covers preschool drop-off and pickup. Each part draws only what its
 * endpoint returned.
 */
export async function ChildHome({ memberId, family }: { memberId: string; family: Family }) {
  const child = family.children[0];
  if (!child) notFound();
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [passport, plan, milestones, shifts, card] = await Promise.all([
    api.GET("/members/{memberId}/passport", path),
    api.GET("/members/{memberId}/plan", path),
    api.GET("/members/{memberId}/children/{childId}/milestones", { params: { path: { memberId, childId: child.id } } }),
    api.GET("/members/{memberId}/shifts", path),
    api.GET("/members/{memberId}/children/{childId}/passport", { params: { path: { memberId, childId: child.id } } }),
  ]);
  if (passport.response.status === 401) redirect("/");

  const people = familyPeople(family);
  const byId = new Map(people.map((p) => [p.id, p]));
  const vaccines = passport.data?.people.find((p) => p.id === child.id)?.vaccines ?? [];
  // What the rules ask for this child: vaccines and screenings that are due or overdue. Shown here as the way in; the reason and source open on This week.
  const dueItems = (plan.data?.items ?? []).filter((i) => (i.category === "vaccine" || i.category === "screening") && i.status !== "upcoming");
  const childcare = (shifts.data?.items ?? []).filter((s) => s.status === "active");
  // Doses given long ago add nothing: the last few, then anything still to give.
  const given = vaccines.filter((v) => v.status === "done").slice(-3);
  const open = vaccines.filter((v) => v.status !== "done");
  const unseen = milestones.data ? milestones.data.items.filter((m) => !m.observed).length : 0;

  const headline = dueItems.length > 0 ? `${countThings(dueItems.length)} for ${child.name} ${dueItems.length === 1 ? "is" : "are"} due.` : `${child.name} is up to date.`;
  const sub = [milestones.data ? `${unseen} milestones to watch for` : undefined, childcare.length ? `${new Set(childcare.map((s) => s.memberId)).size} of you cover preschool` : undefined].filter(Boolean).join(" · ");

  return (
    <PageFrame>
      <header>
        <h1 className="max-w-2xl text-headline text-balance">{headline}</h1>
        <p className="mt-2 text-label font-normal text-muted-foreground">
          {familyContext(family)}
          {sub ? ` · ${sub}` : ""}
        </p>
      </header>

      <PageGrid>
        <Stack>
          {dueItems.length > 0 && <DueNow items={dueItems} weekHref={`/family/${memberId}`} />}
          {(given.length > 0 || open.length > 0) && <VaccineTimeline vaccines={[...given, ...open]} />}
        </Stack>
        <Stack>
          {childcare.length > 0 && (
            <section aria-labelledby="childcare-title" className="rounded-2xl border border-border bg-card p-5">
              <h2 id="childcare-title" className="text-title">
                Preschool days
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {childcare.map((s) => {
                  const who = byId.get(s.memberId);
                  return (
                    <li key={s.id}>
                      <ShiftCard shift={s} owner={who ? { name: who.displayName, role: who.role } : undefined} className="bg-card" />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {card.data && <BabyCard passport={card.data} />}
        </Stack>
      </PageGrid>

      {milestones.data && <MilestoneCard memberId={memberId} childId={child.id} childName={child.name} checklist={milestones.data} />}
    </PageFrame>
  );
}

function DueNow({ items, weekHref }: { items: PlanItem[]; weekHref: string }) {
  return (
    <section aria-labelledby="due-title" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="due-title" className="text-title">
        Due now
      </h2>
      <ul className="mt-3 flex flex-col gap-1">
        {items.map((i) => {
          const Icon = categoryIcon[i.category];
          return (
            <li key={i.ruleId}>
              <Link href={weekHref} className="flex min-h-11 items-center gap-3 rounded-xl px-1 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", statusTint[i.status])}>
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-body font-medium">{i.title}</span>
                <CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-caption text-muted-foreground">The reason and source for each are on This week.</p>
    </section>
  );
}
