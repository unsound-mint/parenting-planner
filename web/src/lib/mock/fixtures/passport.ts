import { mock } from "../registry";
import { isoDate, uid } from "./dates";

// Emily (week 25) and Jake. The acting parent is whoever's id is in the path.
export const passportMocks = {
  ...mock("/members/{memberId}/passport", "get", (ctx) => ({
    memberId: ctx.path.memberId,
    people: [
      {
        id: ctx.path.memberId,
        kind: "parent",
        name: "Emily",
        role: "mother",
        isActingParent: true,
        labs: [
          { id: uid(110), name: "Glucose, 1-hour screen", value: 118, unit: "mg/dL", refLow: 70, refHigh: 139, takenOn: isoDate(-6), visibility: "partner" },
          { id: uid(111), name: "Ferritin", value: 18, unit: "ng/mL", refLow: 30, refHigh: 200, takenOn: isoDate(-40), visibility: "partner" },
          { id: uid(112), name: "Hemoglobin", value: 11.6, unit: "g/dL", refLow: 11, refHigh: 14, takenOn: isoDate(-40), visibility: "family" },
          { id: uid(113), name: "TSH", value: 2.1, unit: "mIU/L", refLow: 0.4, refHigh: 4, takenOn: isoDate(-40), visibility: "private" },
        ],
        vaccines: [
          { id: uid(120), name: "Flu", dose: "This season", status: "done", givenOn: isoDate(-30), visibility: "family" },
          { id: uid(121), name: "Tdap", dose: "Pregnancy dose, weeks 27 to 36", status: "due", dueOn: isoDate(14), visibility: "partner" },
          { id: uid(122), name: "RSV", dose: "Weeks 32 to 36", status: "upcoming", dueOn: isoDate(55), visibility: "partner" },
        ],
        allergies: [{ id: uid(130), substance: "Penicillin", certainty: "confirmed", reaction: "Rash", notedOn: "2019-03-02", visibility: "family" }],
        growth: [],
        careTeam: [
          { id: uid(140), name: "Dr. Maya Reyes", role: "obstetrician", clinic: "Lakeside Women's Health", phone: "555-0142" },
          { id: uid(141), name: "Dr. Anna Weiss", role: "psychologist", clinic: "Harbor Counseling" },
        ],
      },
      {
        id: uid(2),
        kind: "parent",
        name: "Jake",
        role: "partner",
        isActingParent: false,
        labs: [{ id: uid(150), name: "LDL cholesterol", value: 112, unit: "mg/dL", refLow: 0, refHigh: 130, takenOn: isoDate(-120), visibility: "partner" }],
        vaccines: [
          { id: uid(151), name: "Tdap", dose: "Booster, 2 weeks before the baby", status: "due", dueOn: isoDate(60), visibility: "partner" },
          { id: uid(152), name: "Flu", dose: "This season", status: "overdue", dueOn: isoDate(-9), visibility: "partner" },
        ],
        allergies: [],
        growth: [],
        careTeam: [{ id: uid(153), name: "Dr. Tom Okafor", role: "primary_care", clinic: "Northside Family Practice" }],
      },
    ],
  })),
};
