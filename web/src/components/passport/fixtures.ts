import type { Passport } from "@/lib/api/types";

// Dev-only synthetic data for screenshots. Not imported by production code.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const passportFixture: Passport = {
  memberId: id(1),
  people: [
    {
      id: id(1), kind: "parent", name: "Maya", role: "mother", isActingParent: true,
      labs: [
        { id: id(10), name: "Ferritin", value: 18, unit: "ng/mL", refLow: 30, refHigh: 200, takenOn: "2026-10-02", visibility: "partner" },
        { id: id(11), name: "Hemoglobin", value: 12.4, unit: "g/dL", refLow: 11, refHigh: 14, takenOn: "2026-10-02", visibility: "family" },
        { id: id(12), name: "TSH", value: 2.1, unit: "mIU/L", refLow: 0.4, refHigh: 4, takenOn: "2026-10-02", visibility: "private" },
        { id: id(13), name: "Vitamin D", value: 31, unit: "ng/mL", refLow: 30, refHigh: 100, takenOn: "2026-08-14", visibility: "private" },
      ],
      vaccines: [
        { id: id(20), name: "Tdap", dose: "Pregnancy dose", status: "due", dueOn: "2026-11-20", visibility: "partner" },
        { id: id(21), name: "Flu", dose: "2026 season", status: "done", givenOn: "2026-10-05", visibility: "family" },
        { id: id(22), name: "COVID-19", dose: "2026 booster", status: "upcoming", dueOn: "2027-01-15", visibility: "family" },
      ],
      allergies: [{ id: id(30), substance: "Penicillin", certainty: "confirmed", reaction: "Rash", notedOn: "2019-03-02", visibility: "family" }],
      growth: [],
      careTeam: [
        { id: id(40), name: "Dr. Maya Reyes", role: "obstetrician", clinic: "Lakeside Women's Health" },
        { id: id(41), name: "Dr. Anna Weiss", role: "psychologist", clinic: "Harbor Counseling" },
      ],
    },
    {
      id: id(2), kind: "parent", name: "Daniel", role: "partner", isActingParent: false,
      labs: [{ id: id(50), name: "Cholesterol", value: 212, unit: "mg/dL", refLow: 125, refHigh: 200, takenOn: "2026-06-11", visibility: "partner" }],
      vaccines: [{ id: id(51), name: "Tdap", dose: "Booster", status: "overdue", dueOn: "2026-09-01", visibility: "partner" }],
      allergies: [],
      growth: [],
      careTeam: [{ id: id(52), name: "Dr. Tom Okafor", role: "primary_care", clinic: "Northside Family Practice" }],
    },
    {
      id: id(3), kind: "child", name: "Ava", ageMonths: 14, isActingParent: false,
      labs: [{ id: id(60), name: "Lead", value: 1.2, unit: "µg/dL", refLow: 0, refHigh: 3.5, takenOn: "2026-05-20", visibility: "family" }],
      vaccines: [
        { id: id(61), name: "Hepatitis B", dose: "Dose 3 of 3", status: "done", givenOn: "2026-02-10", visibility: "family" },
        { id: id(62), name: "DTaP", dose: "Dose 3 of 5", status: "done", givenOn: "2026-03-12", visibility: "family" },
        { id: id(63), name: "MMR", dose: "Dose 1 of 2", status: "overdue", dueOn: "2026-10-30", visibility: "family" },
        { id: id(64), name: "Varicella", dose: "Dose 1 of 2", status: "due", dueOn: "2026-11-30", visibility: "family" },
        { id: id(65), name: "Hepatitis A", dose: "Dose 2 of 2", status: "upcoming", dueOn: "2027-04-14", visibility: "family" },
      ],
      allergies: [
        { id: id(70), substance: "Egg", certainty: "confirmed", reaction: "Hives within minutes", notedOn: "2026-04-18", visibility: "family" },
        { id: id(71), substance: "Peanut", certainty: "suspected", reaction: "Mild rash around mouth", notedOn: "2026-09-03", visibility: "family" },
      ],
      growth: [
        { measuredOn: "2026-01-14", ageMonths: 8, weightKg: 8.1, heightCm: 70, weightPercentile: 48, heightPercentile: 52 },
        { measuredOn: "2026-04-15", ageMonths: 11, weightKg: 9.0, heightCm: 74, weightPercentile: 50, heightPercentile: 55 },
        { measuredOn: "2026-07-15", ageMonths: 14, weightKg: 9.8, heightCm: 77.5, weightPercentile: 54, heightPercentile: 58 },
      ],
      careTeam: [{ id: id(80), name: "Dr. Priya Nair", role: "pediatrician", clinic: "Little Oaks Pediatrics" }],
    },
  ],
};
