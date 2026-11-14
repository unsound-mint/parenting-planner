import { Lock } from "lucide-react";
import type { PassportPerson } from "@/lib/api/types";
import { PageFrame, PageGrid, Stack } from "@/components/shell/page";
import { AllergiesCard } from "./allergies-card";
import { CareTeamCard } from "./care-team-card";
import { GrowthCard } from "./growth-card";
import { LabsCard } from "./labs-card";
import { PersonTabs } from "./person-tabs";
import { ScreeningsCard } from "./screenings-card";
import { attentionCount, followUps } from "./summary";
import { VaccineTimeline } from "./vaccine-timeline";

// The passport for one person: one section per kind of record, each fact once.
// What needs a look is marked inside its own section (a due dose, a flagged
// value, a suspected allergy); the headline only counts them. Three columns on
// wide screens: what gets done (vaccines, screenings), what was measured (labs),
// and who and what to know (allergies, care team, growth).
export function PassportBody({ memberId, people, personId }: { memberId: string; people: PassportPerson[]; personId: string }) {
  const person = people.find((p) => p.id === personId) ?? people[0];
  const attention = followUps(person).length;
  const attentionById = Object.fromEntries(people.map((p) => [p.id, attentionCount(p)]));
  const whose = person.isActingParent ? "your" : `${person.name}'s`;
  const headline =
    attention === 0
      ? `${person.isActingParent ? "Your" : `${person.name}'s`} passport is up to date.`
      : `${attention === 1 ? "One thing" : `${attention} things`} to look at in ${whose} passport.`;
  const canWrite = person.isActingParent || person.kind === "child";

  return (
    <PageFrame className="block">
      <h1 className="max-w-3xl text-headline text-balance">{headline}</h1>
      <div className="mt-4">
        <PersonTabs people={people} selectedId={person.id} base={`/family/${memberId}/passport`} attention={attentionById} />
      </div>
      {person.kind === "parent" && !person.isActingParent && (
        <p className="mt-3 flex items-center gap-2 text-label text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Only what {person.name} has shared with you is shown here, and only {person.name} can change it.
        </p>
      )}

      <PageGrid cols={3} className="mt-6 gap-4 lg:gap-6">
        <Stack className="gap-4 lg:gap-6">
          <VaccineTimeline vaccines={person.vaccines} edit={canWrite ? { memberId, childId: person.kind === "child" ? person.id : undefined } : undefined} />
          <ScreeningsCard person={person} memberId={memberId} />
        </Stack>
        <LabsCard person={person} memberId={memberId} canAsk={canWrite} />
        <div className="grid min-w-0 items-start gap-4 lg:gap-6 @4xl:col-span-2 @4xl:grid-cols-2 @7xl:col-span-1 @7xl:grid-cols-1">
          <AllergiesCard person={person} memberId={memberId} />
          <CareTeamCard person={person} memberId={memberId} />
          {person.kind === "child" && <GrowthCard growth={person.growth} />}
        </div>
      </PageGrid>
    </PageFrame>
  );
}
