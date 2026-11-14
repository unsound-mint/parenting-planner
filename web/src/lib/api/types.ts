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
export type Provider = S["Provider"];
export type ProviderType = S["ProviderType"];
export type BookingRequest = S["BookingRequest"];
export type WeeklyPlan = S["WeeklyPlan"];
export type WeeklyPlanSection = S["WeeklyPlanSection"];
export type WeeklyPlanPoint = S["WeeklyPlanPoint"];
export type MoodPattern = S["MoodPattern"];
export type MoodPatternKind = S["MoodPatternKind"];
export type Tier = S["Tier"];
export type PaidTier = S["PaidTier"];
export type UpgradeIntent = S["UpgradeIntent"];
