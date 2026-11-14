import type { components } from "./schema.gen";

// Short names for the generated API types. Do not hand-write API shapes.
type S = components["schemas"];
export type Family = S["Family"];
export type Parent = S["Parent"];
export type Plan = S["Plan"];
export type PlanItem = S["PlanItem"];
export type DemoTemplate = S["DemoTemplate"];
