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
export type PlanItemProgress = S["PlanItemProgress"];
export type Visibility = S["Visibility"];
export type MoodCheckin = S["MoodCheckin"];
export type MoodCheckinInput = S["MoodCheckinInput"];
export type PlanCategory = S["PlanCategory"];
export type Tier = S["Tier"];
export type PaidTier = S["PaidTier"];
export type UpgradeIntent = S["UpgradeIntent"];
