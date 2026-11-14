import type { PregnancyGrowth, PregnancyGrowthWeek } from "@/lib/api/types";
import { mock } from "../registry";

// Preview of the 3D baby's weeks, used only if the API answers 501. A few
// weeks, copied from api/internal/content (size_weeks.json and
// growth_weeks.json); the view snaps the scrubber to the nearest week it has.
const CHECKED = "2026-11-14";
const nhs = (week: number) => ({
  title: `NHS Start for Life: Week ${week}, week-by-week guide to pregnancy`,
  url: `https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/${week <= 12 ? "1st" : week <= 27 ? "2nd" : "3rd"}-trimester/week-${week}/`,
  checkedAt: CHECKED,
});

function week(n: number, comparison: string, lengthCm: number, hotspots: [PregnancyGrowthWeek["hotspots"][number]["area"], string][]): PregnancyGrowthWeek {
  return {
    week: n,
    size: { comparison, lengthCm, lengthMeasure: n < 7 ? "embryo" : n < 20 ? "crown-rump" : "crown-heel", sources: [nhs(n)] },
    hotspots: hotspots.map(([area, text]) => ({ area, text, sources: [nhs(n)] })),
  };
}

const growth: PregnancyGrowth = {
  currentWeek: 25,
  weeks: [
    week(6, "a pea", 0.6, [
      ["heart", "There is a little bump where the heart is growing."],
      ["hands", "Small limb buds have appeared, the start of arms and legs."],
    ]),
    week(12, "a plum", 5.4, [["bones", "The skeleton is hardening from soft tissue into bone."]]),
    week(20, "a banana", 25.6, [["skin", "A white, creamy coating called vernix now protects the skin."]]),
    week(25, "a zucchini", 34.6, [["movement", "A loud noise may make your baby jump, and you might feel the odd hiccup."]]),
    week(33, "a pineapple", 43.7, [["brain", "The brain and nervous system are now fully developed."]]),
    week(40, "a pumpkin", 51.2, [["body", "This is your due date week. Your baby is snug and keeps moving in their usual pattern."]]),
  ],
};

export const pregnancyGrowthMocks = mock("/members/{memberId}/pregnancy-growth", "get", () => growth);
