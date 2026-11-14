import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "./db";
import type { Role } from "./db/schema";

export type Member = typeof schema.members.$inferSelect;
export type Task = typeof schema.tasks.$inferSelect;
export type CareLog = typeof schema.careLogs.$inferSelect;
export type Handoff = typeof schema.handoffs.$inferSelect;

export type ParentView = {
  family: typeof schema.families.$inferSelect;
  me: Member;
  partner: Member;
  /** Tasks and shifts assigned to me in the current stage. */
  myTasks: Task[];
  /** Everything in the current stage, for the shared family plan. */
  familyPlan: Task[];
  lastFeeding: CareLog | null;
  /** A handoff waiting for me to accept, if any. */
  incomingHandoff: Handoff | null;
  completedLessonIds: string[];
};

// Everything one parent's "Today" screen needs, in one call.
export function getParentView(familyId: string, role: Role): ParentView | null {
  const family = db.query.families.findFirst({ where: eq(schema.families.id, familyId) }).sync();
  if (!family) return null;

  const members = db.select().from(schema.members).where(eq(schema.members.familyId, familyId)).all();
  const me = members.find((m) => m.role === role);
  const partner = members.find((m) => m.role !== role);
  if (!me || !partner) return null;

  const familyPlan = db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.familyId, familyId), eq(schema.tasks.activeFrom, family.stage)))
    .orderBy(schema.tasks.startMinute, schema.tasks.createdAt)
    .all();

  const lastFeeding =
    db
      .select()
      .from(schema.careLogs)
      .where(and(eq(schema.careLogs.familyId, familyId), eq(schema.careLogs.type, "feeding")))
      .orderBy(desc(schema.careLogs.at))
      .limit(1)
      .get() ?? null;

  const incomingHandoff =
    db
      .select()
      .from(schema.handoffs)
      .where(and(eq(schema.handoffs.toMemberId, me.id), isNull(schema.handoffs.acceptedAt)))
      .orderBy(desc(schema.handoffs.createdAt))
      .limit(1)
      .get() ?? null;

  const completedLessonIds = db
    .select({ lessonId: schema.trainingProgress.lessonId, completedAt: schema.trainingProgress.completedAt })
    .from(schema.trainingProgress)
    .where(eq(schema.trainingProgress.memberId, me.id))
    .all()
    .filter((p) => p.completedAt)
    .map((p) => p.lessonId);

  return {
    family,
    me,
    partner,
    myTasks: familyPlan.filter((t) => t.assigneeId === me.id),
    familyPlan,
    lastFeeding,
    incomingHandoff,
    completedLessonIds,
  };
}
