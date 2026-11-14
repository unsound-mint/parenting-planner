import type { components } from "./schema.gen";

// Short names for the generated API types. Do not hand-write API shapes.
type S = components["schemas"];
export type Family = S["Family"];
export type Parent = S["Parent"];
export type Plan = S["Plan"];
export type PlanItem = S["PlanItem"];
export type DemoTemplate = S["DemoTemplate"];
export type Stage = S["Stage"];
export type PlanItemStatus = S["PlanItemStatus"];
export type Visibility = S["Visibility"];
export type MoodCheckin = S["MoodCheckin"];
export type MoodCheckinInput = S["MoodCheckinInput"];
export type PlanCategory = S["PlanCategory"];
export type DiaryEntry = S["DiaryEntry"];
export type DiaryEntryInput = S["DiaryEntryInput"];
export type AgendaTopic = S["AgendaTopic"];
export type Provider = S["Provider"];
export type PsychologistAgenda = S["PsychologistAgenda"];
export type PsychologistBooking = S["PsychologistBooking"];
export type PsychologistSlots = S["PsychologistSlots"];
export type Slot = S["Slot"];
export type SessionNote = S["SessionNote"];
