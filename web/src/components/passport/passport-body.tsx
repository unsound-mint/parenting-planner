"use client";

import { useState } from "react";
import { Lock, Plus } from "lucide-react";
import type { PassportPerson } from "@/lib/api/types";
import { GrowthCard } from "./growth-card";
import { LabsCard } from "./labs-card";
import { LogRecord, type LogPrefill } from "./log-record";
import { NextStep } from "./next-step";
import { PersonTabs } from "./person-tabs";
import { ProfileCard } from "./profile-card";
import { attentionCount, followUps, tally, withLogged, type Logged } from "./summary";
import { SummaryCard } from "./summary-card";
import { VaccineTimeline } from "./vaccine-timeline";
import { vaccineKey } from "@/lib/vaccines";

// The passport screen below the server fetch. Holds what the parent just
// logged, so the next step, rings, vaccine timeline and labs change at once
// while the preview mocks store nothing; with the real API the page refreshes
// instead and the held records are never used.
export function PassportBody({ memberId, people, personId }: { memberId: string; people: PassportPerson[]; personId: string }) {
  const [logged, setLogged] = useState<Record<string, Logged>>({});
  const [form, setForm] = useState<LogPrefill | null>(null);
  const shown = people.map((p) => withLogged(p, logged[p.id]));
  const person = shown.find((p) => p.id === personId) ?? shown[0];
  const items = followUps(person);
  const attention = items.length;
  const attentionById = Object.fromEntries(shown.map((p) => [p.id, attentionCount(p)]));
  const owner = person.isActingParent ? "your" : `${person.name}'s`;
  const headline =
    attention === 0
      ? `${person.isActingParent ? "Your" : `${person.name}'s`} passport is up to date.`
      : `${attention === 1 ? "One thing" : `${attention} things`} to follow up in ${owner} passport.`;
  const canLog = person.isActingParent || person.kind === "child";

  function add(more: Partial<Logged>) {
    setLogged((l) => {
      const cur = l[person.id] ?? { vaccines: [], labs: [] };
      return { ...l, [person.id]: { vaccines: [...cur.vaccines, ...(more.vaccines ?? [])], labs: [...cur.labs, ...(more.labs ?? [])] } };
    });
  }

  return (
    <main className="flex-1 px-4 pt-6 pb-16 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="max-w-2xl text-headline text-balance">{headline}</h1>
        {canLog && !form && (
          <button
            type="button"
            onClick={() => setForm({ nonce: Date.now() })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-label font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9"
          >
            <Plus className="size-4" aria-hidden />
            Log a record
          </button>
        )}
      </div>
      <div className="mt-4">
        <PersonTabs people={shown} selectedId={person.id} base={`/family/${memberId}/passport`} attention={attentionById} />
      </div>
      {person.kind === "parent" && !person.isActingParent && (
        <p className="mt-3 flex items-center gap-2 text-label text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Only what {person.name} has shared with you is shown here.
        </p>
      )}

      {form && canLog && (
        <div className="mt-6">
          <LogRecord key={`${person.id}-${form.nonce}`} memberId={memberId} person={person} prefill={form} onLogged={add} onClose={() => setForm(null)} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:gap-6">
        <SummaryCard tally={tally(person)} />
        <NextStep
          person={person}
          items={items}
          onLogVaccine={
            canLog
              ? (name) => {
                  setForm({ vaccine: vaccineKey(name), nonce: Date.now() });
                  document.getElementById("log-title")?.scrollIntoView({ block: "center", behavior: "smooth" });
                }
              : undefined
          }
        />
      </div>
      <div className="mt-4 lg:mt-6">
        <ProfileCard allergies={person.allergies} careTeam={person.careTeam} />
      </div>
      <div className="mt-4 grid items-start gap-4 lg:mt-6 lg:grid-cols-2 lg:gap-6">
        <LabsCard labs={person.labs} showVisibility={person.isActingParent} memberId={memberId} canAsk={canLog} owner={person.kind === "child" ? person.name : undefined} />
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <VaccineTimeline vaccines={person.vaccines} />
          {person.kind === "child" && <GrowthCard growth={person.growth} />}
        </div>
      </div>
    </main>
  );
}
