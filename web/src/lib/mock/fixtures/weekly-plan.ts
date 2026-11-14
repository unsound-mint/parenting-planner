import { inLossSupport } from "@/lib/loss";
import { mock } from "../registry";
import { CHECKED, isoAt } from "./dates";
import { babyWeeks, isNewborn, newbornTeam, olderStage } from "../timeline";

const tdap = {
  title: "CDC: Vaccinating Pregnant Patients (pertussis)",
  url: "https://www.cdc.gov/pertussis/hcp/vaccine-recommendations/vaccinating-pregnant-patients.html",
  checkedAt: CHECKED,
};
const glucose = {
  title: "USPSTF: Gestational Diabetes, Screening",
  url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/gestational-diabetes-screening",
  checkedAt: CHECKED,
};
const perinatal = {
  title: "USPSTF: Perinatal Depression, Preventive Interventions",
  url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/perinatal-depression-preventive-interventions",
  checkedAt: CHECKED,
};

// Same sources as the real rules for these plan items (api/internal/rules).
const postpartumCare = {
  title: "WHO: Quality care for women and newborns in the first weeks after childbirth (postnatal care guidelines, 2022)",
  url: "https://www.who.int/news/item/30-03-2022-who-urges-quality-care-for-women-and-newborns-in-critical-first-weeks-after-childbirth",
  checkedAt: CHECKED,
};
const infantVaccines = {
  title: "CDC: Child and Adolescent Immunization Schedule Notes (2025)",
  url: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-notes.html",
  checkedAt: CHECKED,
};
const dadsHelp = { title: "Postpartum Support International: Help for Dads", url: "https://www.postpartum.net/get-help/help-for-dads/", checkedAt: CHECKED };

const partnerVaccines = {
  title: "CDC: Vaccines for Family and Caregivers",
  url: "https://www.cdc.gov/vaccines-pregnancy/about/vaccines-family-caregivers.html",
  checkedAt: CHECKED,
};

// ruleId must be a real rule id (api/internal/rules): This week attaches each
// point to the plan item it talks about, and a point that matches nothing
// shows on its own. A mock cannot pick by role from the path alone, so it
// reads the session's family to send the partner his own note.
export const weeklyPlanMocks = {
  ...mock("/members/{memberId}/weekly-plan", "get", async (ctx) => {
    const family = await ctx.family();
    // This note is about week 25. In pregnancy loss support answer like the rule
    // fallback, which the AI plan card does not draw.
    if (inLossSupport(family)) return { memberId: ctx.path.memberId, generatedAt: isoAt(0, 6), fallback: true, intro: "", sections: [] };
    // The note below is about week 25. Other stages answer like the rule fallback, which the AI plan card does not draw.
    if (olderStage(family)) return { memberId: ctx.path.memberId, generatedAt: isoAt(0, 6), fallback: true, intro: "", sections: [] };
    const partner = family.parents.find((p) => p.id === ctx.path.memberId)?.role === "partner";
    if (isNewborn(family)) {
      const weeks = babyWeeks(family);
      const baby = family.children[0]?.name ?? "The baby";
      const vaccines = {
        text: `Book the 2-month vaccine visit with ${newbornTeam.pediatrician.name} this week.`,
        reason: `${baby} is ${weeks} weeks old and the first doses are due at 2 months.`,
        ruleId: "infant-2-month-vaccines",
        source: infantVaccines,
      };
      return {
        memberId: ctx.path.memberId,
        generatedAt: isoAt(0, 6),
        fallback: false,
        intro: partner
          ? `${baby} is ${weeks} weeks old. Your nights are the hard part, so keep the rest of the week small.`
          : `${baby} is ${weeks} weeks old. Two things are open for you this week, and neither takes long to book.`,
        sections: partner
          ? [
              {
                title: "For you",
                points: [
                  {
                    text: "Take the five-minute mood questionnaire. Your answers stay private unless you share them.",
                    reason: "You logged a low mood 3 times this week and have not taken it since the 1-month window opened.",
                    ruleId: "mood-screen-partner",
                    source: dadsHelp,
                  },
                ],
              },
              { title: "For you both", points: [vaccines] },
            ]
          : [
              {
                title: "For you",
                points: [
                  {
                    text: `Book your own checkup with ${newbornTeam.obstetrician.name}. It is for you, not only the baby.`,
                    reason: `${baby} is ${weeks} weeks old and no checkup after the birth is on record.`,
                    ruleId: "postpartum-visit",
                    source: postpartumCare,
                  },
                ],
              },
              { title: "For you both", points: [vaccines] },
            ],
      };
    }
    return {
      memberId: ctx.path.memberId,
      generatedAt: isoAt(0, 6),
      fallback: false,
      intro: partner
        ? "Week 25 is a quiet week for you. One booster, booked early, protects the baby."
        : "You are in week 25 and the next weeks are about two appointments, not a long list. Your sleep dipped a little, so keep the rest light.",
      sections: partner
        ? [
            {
              title: "For you",
              points: [
                {
                  text: "Book your Tdap booster with your own doctor before the end of January.",
                  reason: "Your booster should be at least 2 weeks before the baby arrives on Feb 27.",
                  ruleId: "tdap-partner",
                  source: partnerVaccines,
                },
              ],
            },
            {
              title: "For you both",
              points: [
                {
                  text: "Start your half of the hospital bag this weekend, so the last weeks stay calm.",
                  reason: "The bag is on your shared plan and the due date is 15 weeks away.",
                },
              ],
            },
          ]
        : [
            {
              title: "For you",
              points: [
                {
                  text: "Book the glucose screen with Dr. Shah this week. It is a one-time test from week 24.",
                  reason: "You are in week 25 and the screen is not booked yet.",
                  ruleId: "glucose-screen",
                  source: glucose,
                },
                {
                  text: "Bring your low-mood days to your next session. You do not have to wait for them to pass.",
                  reason: "Your check-ins show low mood on 3 days, with under 6 hours of sleep.",
                  ruleId: "low-mood-mother",
                  source: perinatal,
                },
                {
                  text: "Plan your Tdap dose for the start of week 27, in two weeks.",
                  reason: "One dose each pregnancy, preferably early in weeks 27 to 36.",
                  ruleId: "tdap-pregnancy",
                  source: tdap,
                },
              ],
            },
            {
              title: "For you both",
              points: [
                {
                  text: "Jake can ask for his own Tdap booster at least 2 weeks before the baby arrives.",
                  reason: "His booster is due and the baby is due in about 15 weeks.",
                  source: partnerVaccines,
                },
              ],
            },
          ],
    };
  }),
};
