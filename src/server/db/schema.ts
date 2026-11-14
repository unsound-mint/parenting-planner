import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const STAGES = ["pregnancy", "baby_home"] as const;
export type Stage = (typeof STAGES)[number];

export const ROLES = ["mom", "partner"] as const;
export type Role = (typeof ROLES)[number];

// One row per demo visitor. Each judge who presses "Start demo" gets a fresh
// family, so concurrent visitors never see each other's changes.
export const families = sqliteTable("families", {
  id: id(),
  stage: text("stage", { enum: STAGES }).notNull().default("pregnancy"),
  babyName: text("baby_name").notNull(),
  dueDate: integer("due_date", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

export const members = sqliteTable(
  "members",
  {
    id: id(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull(),
    name: text("name").notNull(),
  },
  (t) => [index("members_family_idx").on(t.familyId)],
);

export const TASK_KINDS = ["task", "shift"] as const;
export const TASK_STATUSES = ["planned", "proposed", "accepted", "done"] as const;

// A task or care shift. `activeFrom` is the stage in which it shows up in the
// daily schedule; tasks agreed during pregnancy with activeFrom = baby_home
// appear automatically when the family switches stage.
export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind", { enum: TASK_KINDS }).notNull().default("task"),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("planned"),
    assigneeId: text("assignee_id").references(() => members.id),
    activeFrom: text("active_from", { enum: STAGES }).notNull(),
    // Minutes from midnight, local to the family. Shifts use both, tasks may use neither.
    startMinute: integer("start_minute"),
    endMinute: integer("end_minute"),
    // Training lesson that produced this task, if any (see src/content/training.ts).
    sourceLessonId: text("source_lesson_id"),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_family_idx").on(t.familyId)],
);

export const trainingProgress = sqliteTable(
  "training_progress",
  {
    id: id(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    // JSON array of chosen option ids, in order.
    answers: text("answers", { mode: "json" }).$type<string[]>().notNull().default([]),
  },
  (t) => [index("training_member_idx").on(t.memberId)],
);

export const CARE_LOG_TYPES = ["feeding", "diaper", "sleep"] as const;

export const careLogs = sqliteTable(
  "care_logs",
  {
    id: id(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    type: text("type", { enum: CARE_LOG_TYPES }).notNull(),
    at: integer("at", { mode: "timestamp_ms" }).notNull(),
    // Free-form details, e.g. { side: "left", minutes: 15 } or { amountMl: 90 }.
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
    note: text("note"),
  },
  (t) => [index("care_logs_family_at_idx").on(t.familyId, t.at)],
);

export const handoffs = sqliteTable(
  "handoffs",
  {
    id: id(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    fromMemberId: text("from_member_id")
      .notNull()
      .references(() => members.id),
    toMemberId: text("to_member_id")
      .notNull()
      .references(() => members.id),
    note: text("note"),
    createdAt: createdAt(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("handoffs_family_idx").on(t.familyId)],
);
