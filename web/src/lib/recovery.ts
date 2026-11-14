import type { RecoveryBleeding, RecoveryBreasts, RecoveryPelvicFloor, RecoveryWarningSign, RecoveryWound } from "@/lib/api/types";

// Words for the recovery tracker. The warning-sign wording follows CDC's urgent
// maternal warning signs (checked 2026-11-14); fever is in °F as CDC gives it.

export const bleedingOptions: { value: RecoveryBleeding; label: string }[] = [
  { value: "none", label: "None" },
  { value: "spotting", label: "Spotting" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "heavy", label: "Heavy" },
];

export const woundOptions: { value: RecoveryWound; label: string }[] = [
  { value: "not_applicable", label: "No stitches or scar" },
  { value: "healing_well", label: "Healing well" },
  { value: "sore", label: "Sore" },
  { value: "red_or_leaking", label: "Red or leaking" },
];

export const breastOptions: { value: RecoveryBreasts; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "full", label: "Full" },
  { value: "sore", label: "Sore" },
  { value: "not_applicable", label: "Not nursing" },
];

export const pelvicOptions: { value: RecoveryPelvicFloor; label: string }[] = [
  { value: "fine", label: "Fine" },
  { value: "leaking", label: "Leaking" },
  { value: "heaviness", label: "Heavy or dragging" },
  { value: "painful", label: "Painful" },
];

export const sleepOptions = [
  { value: 3, label: "3 h or less" },
  { value: 4.5, label: "About 4 h" },
  { value: 6, label: "About 6 h" },
  { value: 7.5, label: "7 h or more" },
] as const;

export const warningSigns: { value: RecoveryWarningSign; label: string }[] = [
  { value: "heavy_bleeding", label: "Heavy bleeding or discharge" },
  { value: "fever", label: "Fever of 100.4°F or higher" },
  { value: "severe_headache", label: "Headache that will not go away" },
  { value: "chest_pain", label: "Chest pain or a racing heart" },
  { value: "trouble_breathing", label: "Trouble breathing" },
  { value: "leg_swelling_pain", label: "Swelling, redness or pain in a leg or arm" },
  { value: "self_harm_thoughts", label: "Thoughts of harming yourself or your baby" },
];

export const bleedingLabel = Object.fromEntries(bleedingOptions.map((o) => [o.value, o.label])) as Record<RecoveryBleeding, string>;
export const woundLabel = Object.fromEntries(woundOptions.map((o) => [o.value, o.label])) as Record<RecoveryWound, string>;
export const breastLabel = Object.fromEntries(breastOptions.map((o) => [o.value, o.label])) as Record<RecoveryBreasts, string>;
export const pelvicLabel = Object.fromEntries(pelvicOptions.map((o) => [o.value, o.label])) as Record<RecoveryPelvicFloor, string>;
