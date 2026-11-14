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

export const weeklyPlanMocks = {
  ...mock("/members/{memberId}/weekly-plan", "get", (ctx) => ({
    memberId: ctx.path.memberId,
    generatedAt: isoAt(0, 6),
    fallback: false,
    intro: "You are in week 25 and the next weeks are about two appointments, not a long list. Your sleep dipped a little, so keep the rest light.",
    sections: [
      {
        title: "For you",
        points: [
          {
            text: "Book the glucose screen with Dr. Reyes this week. It is a one-time test from week 24.",
            reason: "You are in week 25 and the screen is not booked yet.",
            ruleId: "pregnancy-glucose-screen",
            source: glucose,
          },
          {
            text: "Plan your Tdap dose for the start of week 27, in two weeks.",
            reason: "One dose each pregnancy, preferably early in weeks 27 to 36.",
            ruleId: "pregnancy-tdap",
            source: tdap,
          },
          {
            text: "Bring your low-mood days to your next session. You do not have to wait for them to pass.",
            reason: "Your check-ins show low mood on 3 days, with under 6 hours of sleep.",
            source: perinatal,
          },
        ],
      },
      {
        title: "For you both",
        points: [
          {
            text: "Jake can ask for his own Tdap booster at least 2 weeks before the baby arrives.",
            reason: "His booster is due and the baby is due in about 15 weeks.",
            ruleId: "pregnancy-partner-tdap",
            source: {
              title: "CDC: Vaccines for Family and Caregivers",
              url: "https://www.cdc.gov/vaccines-pregnancy/about/vaccines-family-caregivers.html",
              checkedAt: CHECKED,
            },
          },
        ],
      },
    ],
  })),
};
