import type { StageNow } from "@/lib/api/types";
import { mock } from "../registry";

// Preview of the stage hero line. The real endpoint picks the line from the
// family's stage and the youngest child's age; the preview shows the line the
// demo families land on today (newborn: week 8 of life, preschool: 4 years,
// planning and everything else: the planning line). Text and sources are the
// ones in api/internal/content/stage_now.json, pages opened 2026-11-14.
const CHECKED = "2026-11-14";
const cdc = (title: string, url: string) => ({ title: `CDC: ${title} (Learn the Signs. Act Early.)`, url, checkedAt: CHECKED });
const CHILDREN_VARY = "Every child grows at their own pace. If you are not seeing something, mention it to your pediatrician.";

const newborn: StageNow = {
  stage: "newborn",
  period: "Week 8 of life",
  headline: "Week 8: your baby watches you move.",
  detail: "Most babies by 2 months watch you as you move, look at a toy for several seconds and hold their head up on their tummy.",
  playIdea: "Hold a rattle off to one side of your baby's head and see if their eyes follow.",
  note: CHILDREN_VARY,
  sources: [cdc("Milestones by 2 Months", "https://www.cdc.gov/act-early/milestones/2-months.html")],
};

const preschool: StageNow = {
  stage: "preschool",
  period: "4 years",
  headline: "4 years: a storyteller.",
  detail:
    "Most children by 4 years say sentences with four or more words, talk about something that happened in their day, name a few colors and catch a large ball most of the time.",
  playIdea: "Play freeze dance to their favorite songs.",
  note: CHILDREN_VARY,
  sources: [cdc("Milestones by 4 Years", "https://www.cdc.gov/act-early/milestones/4-years.html")],
};

const planning: StageNow = {
  stage: "planning",
  period: "Planning",
  headline: "Getting ready together, before you try.",
  detail:
    "A visit to your doctor is the place to go over health history, medicines and vaccines. The Office on Women's Health suggests starting that conversation well before you try, and CDC guidance mentions folic acid before pregnancy. Ask your doctor what fits you.",
  playIdea: "Sit down together and write one list of questions for the preconception visit.",
  note: "Your doctor can tell you what fits your own health.",
  sources: [
    { title: "CDC: Planning for Pregnancy", url: "https://www.cdc.gov/pregnancy/about/index.html", checkedAt: CHECKED },
    { title: "Office on Women's Health: Preconception health", url: "https://womenshealth.gov/pregnancy/you-get-pregnant/preconception-health", checkedAt: CHECKED },
    { title: "NICHD: Pre-Pregnancy Care and Prenatal Care", url: "https://www.nichd.nih.gov/health/topics/factsheets/preconceptioncare", checkedAt: CHECKED },
  ],
};

export const stageNowMocks = {
  ...mock("/members/{memberId}/now", "get", async (ctx) => {
    const family = await ctx.family();
    if (family.template === "newborn") return newborn;
    if (family.template === "preschool") return preschool;
    return planning;
  }),
};
