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
 * outside range, suspected allergies. The headline and the tab dots count
 * these; each section marks its own items.
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

/** How many things in a person's passport want a look; drives the dot on their tab. */
export function attentionCount(person: PassportPerson): number {
  return followUps(person).length;
}
