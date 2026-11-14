import type { MoodPattern, Provider, ProviderSlot, ProviderType, Stage } from "@/lib/api/types";

// Which kinds of help fit a stage, best first, each with the reason a parent
// reads under the pick. A low-mood pattern in the parent's own check-ins
// always comes first. Wording gives a reason, never an instruction.
const stageTypes: Record<Stage, [ProviderType, string][]> = {
  planning: [
    ["obstetrician", "Because a visit before trying is a good time to ask what fits you"],
    ["perinatal_therapist", "Because planning a baby can bring up a lot to talk through"],
  ],
  trying: [
    ["obstetrician", "Because questions about trying are best asked in a visit"],
    ["perinatal_therapist", "Because trying can be stressful, and talking helps many couples"],
  ],
  pregnancy: [
    ["doula", "Because a doula helps you plan the birth and supports you in labor"],
    ["lactation_consultant", "Because meeting a lactation consultant before the birth makes the first feeds easier to plan"],
    ["pediatrician", "Because the baby's doctor is chosen before the birth"],
    ["obstetrician", "Because prenatal visits continue until the birth"],
  ],
  postpartum: [
    ["lactation_consultant", "Because the first weeks of feeding are when help matters most"],
    ["pediatrician", "Because the baby has checkups in the first weeks"],
    ["perinatal_therapist", "Because the weeks after a birth can be hard, and talking helps"],
    ["sleep_consultant", "Because nights are short right now"],
  ],
  infant: [
    ["pediatrician", "Because well-baby visits continue through the first year"],
    ["sleep_consultant", "Because sleep changes a lot in the first year"],
    ["psychologist", "Because the first year is a lot for both parents"],
  ],
  toddler: [
    ["pediatrician", "Because toddler checkups continue every few months"],
    ["sleep_consultant", "Because toddler sleep often shifts"],
    ["child_therapist", "Because big feelings are part of this age"],
  ],
  preschool: [
    ["child_therapist", "Because big feelings and new routines come with preschool"],
    ["pediatrician", "Because yearly checkups continue"],
    ["tutor", "Because early reading starts to matter"],
  ],
  school_age: [
    ["tutor", "Because school brings reading and math to practice"],
    ["child_therapist", "Because school worries are common"],
    ["pediatrician", "Because yearly checkups continue"],
  ],
};

// Families have no stored location yet; every demo family lives around Austin
// (the seeded birth clinic). Picks prefer providers there, then ones who see
// people by video, so a suggestion is never an in-person visit in another state.
export const HOME_STATE = "TX";
const reach = (p: Provider) => (p.state === HOME_STATE ? 0 : p.visitModes.includes("video") ? 1 : 2);

export type Recommendation = { provider: Provider; first?: ProviderSlot; reason: string; pattern: boolean };

/**
 * Up to `limit` providers for this family: the pattern's provider type first,
 * then the stage's types, one provider per type, each the soonest open one.
 * Providers with no open time in the next two weeks, or only in person in
 * another state, are left out.
 */
export function recommend(
  providers: Provider[],
  openings: Map<string, ProviderSlot>,
  pattern: MoodPattern | undefined,
  stage: Stage | undefined,
  /** Providers the parent already booked: their kind is covered, so it is not suggested again. */
  booked: string[] = [],
  limit = 3,
): Recommendation[] {
  const soonest = (t: ProviderType) =>
    providers
      .filter((p) => p.type === t && openings.has(p.id) && reach(p) < 2)
      .sort((a, b) => reach(a) - reach(b) || openings.get(a.id)!.startsAt.localeCompare(openings.get(b.id)!.startsAt))[0];
  const out: Recommendation[] = [];
  const seen = new Set<ProviderType>(providers.filter((p) => booked.includes(p.id)).map((p) => p.type));
  const add = (t: ProviderType, reason: string, fromPattern: boolean) => {
    if (seen.has(t) || out.length >= limit) return;
    const provider = soonest(t);
    if (!provider) return;
    seen.add(t);
    out.push({ provider, first: openings.get(provider.id), reason, pattern: fromPattern });
  };
  if (pattern) add(pattern.providerType, `Because your last ${pattern.days} check-ins were low, talking to someone may help`, true);
  for (const [t, reason] of stage ? stageTypes[stage] : []) add(t, reason, false);
  return out;
}
