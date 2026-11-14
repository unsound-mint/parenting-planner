import type { MoodPattern, Provider, ProviderType, Stage } from "@/lib/api/types";

// Which kinds of help fit a stage, best first. The mood pattern always wins.
const stageTypes: Record<Stage, ProviderType[]> = {
  planning: ["perinatal_therapist", "doula"],
  trying: ["perinatal_therapist", "doula"],
  pregnancy: ["doula", "lactation_consultant", "perinatal_therapist"],
  postpartum: ["lactation_consultant", "sleep_consultant", "perinatal_therapist"],
  infant: ["sleep_consultant", "lactation_consultant", "psychologist"],
  toddler: ["sleep_consultant", "child_therapist"],
  preschool: ["child_therapist", "tutor"],
  school_age: ["tutor", "child_therapist"],
};

export type Recommendation = { provider: Provider; reason: "pattern" | "stage"; days?: number };

/**
 * Up to three providers for this family: the pattern's provider type first
 * (soonest of that type), then the stage's types, one provider per type.
 */
export function recommend(providers: Provider[], pattern: MoodPattern | undefined, stage: Stage | undefined): Recommendation[] {
  const soonest = (t: ProviderType) => providers.filter((p) => p.type === t).sort((a, b) => a.nextAvailable.localeCompare(b.nextAvailable))[0];
  const out: Recommendation[] = [];
  const seen = new Set<ProviderType>();
  const add = (t: ProviderType, reason: Recommendation["reason"]) => {
    const provider = seen.has(t) ? undefined : soonest(t);
    if (!provider || out.length >= 3) return;
    seen.add(t);
    out.push({ provider, reason, days: reason === "pattern" ? pattern?.days : undefined });
  };
  if (pattern) {
    // Two of the pattern's type when there are, so the first choice has an alternative.
    const same = providers.filter((p) => p.type === pattern.providerType).sort((a, b) => a.nextAvailable.localeCompare(b.nextAvailable));
    for (const provider of same.slice(0, 2)) out.push({ provider, reason: "pattern", days: pattern.days });
    seen.add(pattern.providerType);
    add("psychologist", "pattern");
  }
  const patternCount = out.length;
  for (const t of stage ? stageTypes[stage] : []) add(t, "stage");
  // Stage picks have no order of their own beyond fit, so the soonest slot leads.
  const rest = out.splice(patternCount).sort((a, b) => a.provider.nextAvailable.localeCompare(b.provider.nextAvailable));
  return [...out, ...rest];
}
