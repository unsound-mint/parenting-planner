import type { CaregiverPermission, Family } from "@/lib/api/types";

// What a family at each end of the journey does and does not have. The screens
// built for a baby at home (feeds and diapers, night shifts, the newborn
// practice rounds) do not fit a family that is planning or has a child past toddler.

/** A child old enough that the baby log, night shifts and newborn practice do not apply. */
export function hasOlderChild(family: Pick<Family, "stage">): boolean {
  return family.stage === "toddler" || family.stage === "preschool" || family.stage === "school_age";
}

/** Planning or trying: no due date, no child. */
export function isPlanning(family: Pick<Family, "stage">): boolean {
  return family.stage === "planning" || family.stage === "trying";
}

type PermissionText = { name: string; hint: string };

/** What a caregiver can be shown at this stage. Pregnancy updates only exist while pregnant; before a baby there is no log or baby card. */
export function invitablePermissions(family: Pick<Family, "stage">): CaregiverPermission[] {
  if (family.stage === "pregnancy") return ["care_log", "baby_passport", "schedule", "family_plan", "pregnancy_updates"];
  if (isPlanning(family)) return ["schedule", "family_plan"];
  return ["care_log", "baby_passport", "schedule", "family_plan"];
}

/** Stage wording for the permissions that name the baby; null keeps the default in visuals.ts. */
export function permissionTextFor(family: Pick<Family, "stage">, p: CaregiverPermission): PermissionText | null {
  if (!hasOlderChild(family)) return null;
  switch (p) {
    case "care_log":
      return { name: "Meals, naps and notes", hint: "Logs them and takes over at a pickup" };
    case "baby_passport":
      return { name: "Health card", hint: "Allergies, doctor and emergency contacts" };
    case "schedule":
      return { name: "Drop-offs and pickups", hint: "Only the ones they are part of" };
    default:
      return null;
  }
}
