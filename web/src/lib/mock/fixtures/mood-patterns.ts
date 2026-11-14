import { mock } from "../registry";
import { CHECKED, isoDate, uid } from "./dates";

export const moodPatternMocks = {
  ...mock("/members/{memberId}/mood-patterns", "get", () => ({
    items: [
      {
        kind: "low_mood_and_sleep",
        startedOn: isoDate(-4),
        days: 3,
        checkinIds: [uid(301), uid(302), uid(303)],
        message:
          "Your last three check-ins were low, and you slept under 6 hours each night. Many people feel this way in pregnancy. Talking to a perinatal therapist can help, and you can book one from here.",
        providerType: "perinatal_therapist",
        source: {
          title: "USPSTF: Perinatal Depression, Preventive Interventions",
          url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/perinatal-depression-preventive-interventions",
          checkedAt: CHECKED,
        },
      },
    ],
  })),
};
