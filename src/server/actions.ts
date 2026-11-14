"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "./db";
import { STAGES, ROLES, CARE_LOG_TYPES } from "./db/schema";
import { createDemoFamily } from "./seed";
import { FAMILY_COOKIE, getFamilyId } from "./session";

// Server actions are the whole API surface between UI and backend.
// Signatures here are the contract: UI codes against them, backend fills the bodies.
// Every action validates input with zod and scopes writes to the caller's family.

async function requireFamilyId() {
  const id = await getFamilyId();
  if (!id) redirect("/");
  return id;
}

/** Create a fresh synthetic family for this browser and open the split view. */
export async function startDemo() {
  const familyId = createDemoFamily();
  (await cookies()).set(FAMILY_COOKIE, familyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/family");
}

/** Move the family to another life stage. Tasks with that `activeFrom` become visible. */
export async function setStage(stage: (typeof STAGES)[number]) {
  const familyId = await requireFamilyId();
  const parsed = z.enum(STAGES).parse(stage);
  db.update(schema.families).set({ stage: parsed }).where(eq(schema.families.id, familyId)).run();
  revalidatePath("/family", "layout");
}

const completeLessonInput = z.object({
  role: z.enum(ROLES),
  lessonId: z.string(),
  answers: z.array(z.string()),
  /** If true and the lesson offers a shift, add it to this parent's baby_home plan. */
  takeShift: z.boolean(),
});

/** Record a finished training lesson and optionally commit to the shift it offers. */
export async function completeLesson(input: z.input<typeof completeLessonInput>) {
  const familyId = await requireFamilyId();
  completeLessonInput.parse(input);
  void familyId;
  throw new Error("TODO(backend): completeLesson");
}

const logCareInput = z.object({
  role: z.enum(ROLES),
  type: z.enum(CARE_LOG_TYPES),
  at: z.coerce.date().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  note: z.string().max(500).optional(),
});

/** Log a feeding, diaper change or sleep for the baby. */
export async function logCare(input: z.input<typeof logCareInput>) {
  const familyId = await requireFamilyId();
  logCareInput.parse(input);
  void familyId;
  throw new Error("TODO(backend): logCare");
}

const handoffInput = z.object({ fromRole: z.enum(ROLES), note: z.string().max(500).optional() });

/** Hand the baby over to the other parent with an optional note. */
export async function handOff(input: z.input<typeof handoffInput>) {
  const familyId = await requireFamilyId();
  handoffInput.parse(input);
  void familyId;
  throw new Error("TODO(backend): handOff");
}

/** The receiving parent accepts a pending handoff. */
export async function acceptHandoff(handoffId: string) {
  const familyId = await requireFamilyId();
  z.string().parse(handoffId);
  void familyId;
  throw new Error("TODO(backend): acceptHandoff");
}
