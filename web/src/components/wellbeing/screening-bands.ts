import type { ScreeningBand } from "@/lib/api/types";

// Fixed wording per band. The API sends its own fixed message too (never
// generated); this is what shows if it is missing. Wording is Dayana's.
export const bandWords: Record<ScreeningBand, { label: string; step: string }> = {
  green: { label: "Below the cutoff", step: "Nothing to do now. Take it again in a few weeks, or any time things change." },
  amber: { label: "Close to the cutoff", step: "Take it again in two weeks and mention it at your next visit." },
  red: { label: "At or above the cutoff", step: "Talk to your doctor or midwife soon. A questionnaire cannot diagnose anything, they can." },
};
