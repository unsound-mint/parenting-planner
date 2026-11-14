import { mock } from "../registry";
import { isoDate, uid } from "./dates";
import { careTeam, couple, tdap } from "../timeline";
import { vaccineName } from "@/lib/vaccines";

// Emily (week 25) and Jake, with the ids of the session's family. The glucose test is
// still ahead (shared timeline), so there is no glucose result yet.
export const passportMocks = {
  ...mock("/members/{memberId}/passport", "get", async (ctx) => {
    const { mother, partner } = couple(await ctx.family());
    return {
    memberId: ctx.path.memberId,
    people: [
      {
        id: mother.id,
        kind: "parent",
        name: mother.displayName,
        role: "mother",
        isActingParent: ctx.path.memberId === mother.id,
        labs: [
          { id: uid(110), name: "Vitamin D", value: 31, unit: "ng/mL", refLow: 20, refHigh: 50, takenOn: isoDate(-40), visibility: "partner" },
          { id: uid(111), name: "Ferritin", value: 18, unit: "ng/mL", refLow: 30, refHigh: 200, takenOn: isoDate(-40), visibility: "partner", flag: { direction: "low", message: "Outside the usual range. Discuss with your doctor.", basis: "Reference range reported with this lab result" } },
          { id: uid(112), name: "Hemoglobin", value: 11.6, unit: "g/dL", refLow: 11, refHigh: 14, takenOn: isoDate(-40), visibility: "family" },
          { id: uid(113), name: "TSH", value: 2.1, unit: "mIU/L", refLow: 0.4, refHigh: 4, takenOn: isoDate(-40), visibility: "private" },
        ],
        vaccines: [
          { id: uid(120), name: "Flu", dose: "This season", status: "done", givenOn: isoDate(-30), visibility: "family" },
          { id: uid(121), name: "Tdap", dose: "Pregnancy dose, weeks 27 to 36", status: "due", dueOn: isoDate(tdap.motherDueDay), visibility: "partner" },
          { id: uid(122), name: "RSV", dose: "Weeks 32 to 36", status: "upcoming", dueOn: isoDate(55), visibility: "partner" },
        ],
        allergies: [{ id: uid(130), substance: "Penicillin", certainty: "confirmed", reaction: "Rash", notedOn: "2019-03-02", visibility: "family" }],
        growth: [],
        careTeam: [
          { id: uid(140), name: careTeam.obstetrician.name, role: "obstetrician", clinic: careTeam.obstetrician.clinic, phone: careTeam.obstetrician.phone },
          { id: uid(141), name: careTeam.psychologist.name, role: "psychologist", clinic: careTeam.psychologist.clinic },
        ],
      },
      {
        id: partner.id,
        kind: "parent",
        name: partner.displayName,
        role: "partner",
        isActingParent: ctx.path.memberId === partner.id,
        labs: [{ id: uid(150), name: "LDL cholesterol", value: 112, unit: "mg/dL", refLow: 0, refHigh: 130, takenOn: isoDate(-120), visibility: "partner" }],
        vaccines: [
          { id: uid(151), name: "Tdap", dose: "Before the baby arrives", status: "due", dueOn: isoDate(tdap.partnerDueDay), visibility: "partner" },
          { id: uid(152), name: "Flu", dose: "This season", status: "overdue", dueOn: isoDate(-9), visibility: "partner" },
        ],
        allergies: [],
        growth: [],
        careTeam: [{ id: uid(153), name: "Dr. Tom Okafor", role: "primary_care", clinic: "Northside Family Practice" }],
      },
    ],
    };
  }),
  // Logging echoes the record back and stores nothing. The real backend also
  // takes the matching dose or rule item off the plan on the next request and
  // writes an audit row; the passport view applies that locally for previews.
  ...mock("/members/{memberId}/immunizations", "post", (ctx) => ({
    id: crypto.randomUUID(),
    name: vaccineName[ctx.body.vaccine],
    dose: ctx.body.dose ?? "Dose given",
    status: "done",
    givenOn: ctx.body.givenOn,
    visibility: "partner",
  })),
  ...mock("/members/{memberId}/screenings", "post", (ctx) => ({
    id: crypto.randomUUID(),
    childId: ctx.body.childId,
    kind: ctx.body.kind,
    takenOn: ctx.body.takenOn,
    visibility: ctx.body.visibility,
  })),
  ...mock("/members/{memberId}/lab-results", "post", (ctx) => {
    const { refLow, refHigh, value } = ctx.body;
    const direction = refLow != null && value < refLow ? "low" : refHigh != null && value > refHigh ? "high" : undefined;
    return {
      id: crypto.randomUUID(),
      ...ctx.body,
      flag: direction && { direction, message: "Outside the usual range. Discuss with your doctor.", basis: "Reference range reported with this lab result" },
    };
  }),
};
