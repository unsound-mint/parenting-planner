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

export type Focus =
  | { kind: "vaccine"; vaccine: VaccineDose }
  | { kind: "lab"; lab: LabResult }
  | { kind: "allergy"; substance: string }
  | { kind: "none" };

export type Summary = {
  vaccinesNeeded: number;
  labsOutside: number;
  suspectedAllergies: number;
  focus: Focus;
};

/** The one thing to look at first: overdue or due vaccine, then a lab outside range, then an untested allergy. */
export function summarize(person: PassportPerson): Summary {
  const needed = person.vaccines.filter((v) => v.status === "overdue" || v.status === "due");
  const outside = latestLabs(person.labs).filter((l) => ["low", "high"].includes(labPosition(l)));
  const suspected = person.allergies.filter((a) => a.certainty === "suspected");
  const firstVaccine = needed.find((v) => v.status === "overdue") ?? needed[0];
  const focus: Focus = firstVaccine
    ? { kind: "vaccine", vaccine: firstVaccine }
    : outside[0]
      ? { kind: "lab", lab: outside[0] }
      : suspected[0]
        ? { kind: "allergy", substance: suspected[0].substance }
        : { kind: "none" };
  return { vaccinesNeeded: needed.length, labsOutside: outside.length, suspectedAllergies: suspected.length, focus };
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
  const s = summarize(person);
  return s.vaccinesNeeded + s.labsOutside + s.suspectedAllergies;
}
