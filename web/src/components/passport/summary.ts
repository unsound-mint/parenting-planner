import type { LabResult, PassportPerson, VaccineDose } from "@/lib/api/types";

/** Where a lab value sits against its reference range. */
export function labPosition(lab: LabResult): "low" | "in" | "high" | "unknown" {
  if (lab.refLow == null && lab.refHigh == null) return "unknown";
  if (lab.refLow != null && lab.value < lab.refLow) return "low";
  if (lab.refHigh != null && lab.value > lab.refHigh) return "high";
  return "in";
}

/** Latest result per test name; the API sends newest first. */
export function latestLabs(labs: LabResult[]): LabResult[] {
  const seen = new Set<string>();
  return labs.filter((l) => !seen.has(l.name) && seen.add(l.name));
}

/** One thing the parent should act on, in the order it is shown. */
export type FollowUp =
  | { kind: "vaccine"; vaccine: VaccineDose }
  | { kind: "lab"; lab: LabResult }
  | { kind: "allergy"; substance: string };

/**
 * Every open item, most urgent first: overdue vaccines, due vaccines, labs
 * outside range, suspected allergies. The headline count and the Next step
 * list both come from here, so they cannot disagree.
 */
export function followUps(person: PassportPerson): FollowUp[] {
  const vaccines = person.vaccines.filter((v) => v.status === "overdue" || v.status === "due");
  vaccines.sort((a, b) => Number(b.status === "overdue") - Number(a.status === "overdue"));
  const labs = latestLabs(person.labs).filter((l) => ["low", "high"].includes(labPosition(l)));
  const allergies = person.allergies.filter((a) => a.certainty === "suspected");
  return [
    ...vaccines.map((vaccine): FollowUp => ({ kind: "vaccine", vaccine })),
    ...labs.map((lab): FollowUp => ({ kind: "lab", lab })),
    ...allergies.map((a): FollowUp => ({ kind: "allergy", substance: a.substance })),
  ];
}

export type Tally = {
  vaccinesGiven: number;
  vaccinesNeeded: number;
  vaccinesOverdue: number;
  vaccinesTotal: number;
  labsIn: number;
  labsOutside: number;
  labsTotal: number;
};

/** Counts that feed the two rings. Labs count the latest result per test. */
export function tally(person: PassportPerson): Tally {
  const labs = latestLabs(person.labs).map(labPosition);
  return {
    vaccinesGiven: person.vaccines.filter((v) => v.status === "done").length,
    vaccinesNeeded: person.vaccines.filter((v) => v.status === "due").length,
    vaccinesOverdue: person.vaccines.filter((v) => v.status === "overdue").length,
    vaccinesTotal: person.vaccines.length,
    labsIn: labs.filter((p) => p === "in").length,
    labsOutside: labs.filter((p) => p === "low" || p === "high").length,
    labsTotal: labs.length,
  };
}

/** How many things in a person's passport want a look; drives the dot on their tab. */
export function attentionCount(person: PassportPerson): number {
  return followUps(person).length;
}

/** Records the parent just logged, per person, that the passport has not returned yet. */
export type Logged = { vaccines: VaccineDose[]; labs: LabResult[] };

/**
 * The passport with just-logged records applied, for previews whose answers
 * are not stored. A logged dose replaces the earliest open dose of the same
 * vaccine, as the backend does when no dose is named; a lab joins the list.
 * Safe to apply twice: a record the passport already has (same id) is skipped.
 */
export function withLogged(person: PassportPerson, logged?: Logged): PassportPerson {
  if (!logged) return person;
  let vaccines = person.vaccines;
  for (const dose of logged.vaccines) {
    if (vaccines.some((v) => v.id === dose.id)) continue;
    const open = vaccines
      .filter((v) => v.status !== "done" && v.name === dose.name)
      .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""))[0];
    vaccines = open ? vaccines.map((v) => (v === open ? { ...dose, dose: dose.dose === "Dose given" ? open.dose : dose.dose } : v)) : [...vaccines, dose];
  }
  const known = new Set(person.labs.map((l) => l.id));
  const labs = [...logged.labs.filter((l) => !known.has(l.id)), ...person.labs].sort((a, b) => b.takenOn.localeCompare(a.takenOn));
  return { ...person, vaccines, labs };
}
