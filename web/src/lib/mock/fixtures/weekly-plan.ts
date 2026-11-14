import { mock } from "../registry";
import { CHECKED, isoAt } from "./dates";

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
    const partner = family.parents.find((p) => p.id === ctx.path.memberId)?.role === "partner";
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
                  text: "Go with Emily to the glucose screen if you can. It takes about an hour.",
                  reason: "Emily is in week 25 and the screen is not booked yet.",
                  source: glucose,
                },
              ],
            },
          ]
        : [
            {
              title: "For you",
              points: [
                {
                  text: "Book the glucose screen with Dr. Reyes this week. It is a one-time test from week 24.",
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
