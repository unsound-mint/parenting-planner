import { mockNow } from "@/lib/clock";
import type { Family, Task } from "@/lib/api/types";
import { inLossSupport } from "@/lib/loss";
import { mock } from "../registry";
import { childEvents, childTaskPlan, dayOf, events, olderStage, planningTaskPlan, taskId as familyTaskId, taskPlan } from "../timeline";

// Preview data for the Plan screen: the shared plan, US paperwork and the three
// hospital bags of the demo family (Emily, partner Jake, due 2027-02-27). Dates
// follow the family's due date and today, so the timeline always looks lived in.
// State lives in memory per runtime (server render, browser tab) and resets on
// reload; the real backend replaces all of it.

const store = new Map<string, Task[]>();
// Every seeded task is baby prep. In pregnancy loss support they stay stored but
// hidden, like the server keeps hospital bag and paperwork tasks; tasks the
// family adds afterwards still show.
const seeded = new Set<string>();

// Server render and browser seed separately, so ids must match: derive them from
// the family id (still a valid UUID, which the real API checks before it answers 501).
const taskId = familyTaskId;

/** Positions of paperwork tasks in the seed below that other fixtures link to (leave deadlines). */
export const paperworkN = { leaveNotice: 8, inNetwork: 9, preRegister: 10 };

const day = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * day).toISOString().slice(0, 10);
const today = () => mockNow().toISOString().slice(0, 10);

const SSA = { title: "Social Security Administration: Social Security number for your baby", url: "https://www.ssa.gov/ssnumber/", checkedAt: "2026-11-10" };
const HEALTHCARE = { title: "HealthCare.gov: when you can enroll in or change coverage", url: "https://www.healthcare.gov/coverage-outside-open-enrollment/", checkedAt: "2026-11-10" };
const DOL = { title: "U.S. Department of Labor: Family and Medical Leave Act", url: "https://www.dol.gov/agencies/whd/fmla", checkedAt: "2026-11-10" };

const FAMILY_HISTORY = { title: "CDC: About Family Health History", url: "https://www.cdc.gov/family-health-history/about/index.html", checkedAt: "2026-11-14" };

// The planning family's steps before trying, split between Maya and Daniel, and
// the preschool family's next months. Neither has paperwork or hospital bags, so
// those tabs do not show. Folic acid and the MMR shot are plan items from the
// rules engine on This week; they are not repeated here.
function seedOlder(family: Family, stage: "planning" | "child"): Task[] {
  const mother = family.parents.find((p) => p.role === "mother")!.id;
  const partner = family.parents.find((p) => p.role === "partner")!.id;
  const now = today();
  const t = (n: number, o: Partial<Task> & Pick<Task, "title" | "assigneeId">): Task => ({ id: taskId(family.id, n), kind: "task", done: false, ...o });
  if (stage === "planning") {
    return [
      t(planningTaskPlan.history.n, { title: planningTaskPlan.history.title, assigneeId: mother, dueOn: dayOf(planningTaskPlan.history.day), detail: "Parents, brothers, sisters and grandparents: heart disease, diabetes, birth defects, pregnancy losses. Bring the page to the preconception visit.", source: FAMILY_HISTORY }),
      t(2, { title: "List your medicines and supplements", assigneeId: partner, dueOn: addDays(now, 6), detail: "Include anything over the counter. Ask at the visit whether any of it needs to change before you try." }),
      t(3, { title: "Ask the insurer what fertility and prenatal care it covers", assigneeId: partner, pendingAssigneeId: mother, dueOn: addDays(now, 10), detail: "Ask about the preconception visit, carrier screening, prenatal visits and the hospital stay." }),
      t(4, { title: "Ask Dr. Okafor about carrier screening", assigneeId: mother, dueOn: dayOf(9), detail: "It checks whether either of you carries a gene for a condition you could pass on. Ask what it covers, what it costs and who should be tested." }),
      t(planningTaskPlan.budgetTalk.n, { title: planningTaskPlan.budgetTalk.title, assigneeId: partner, dueOn: dayOf(planningTaskPlan.budgetTalk.day), detail: "Agree on the first year's budget, how long each of you wants at home and who you could ask for help." }),
      t(6, { title: "Choose a clinician for the preconception visit", assigneeId: mother, dueOn: addDays(now, -6), done: true }),
    ];
  }
  return [
    t(childTaskPlan.cutoff.n, { title: childTaskPlan.cutoff.title, assigneeId: mother, dueOn: dayOf(childTaskPlan.cutoff.day), detail: "Each state sets a date by which a child must turn 5 to start kindergarten that year." }),
    t(childTaskPlan.tour.n, { title: childTaskPlan.tour.title, assigneeId: partner, dueOn: dayOf(childEvents.schoolTour.day) }),
    t(3, { title: "Collect the immunization record for the kindergarten forms", assigneeId: partner, pendingAssigneeId: mother, dueOn: addDays(now, 12), detail: "The passport lists every dose. Ask the clinic for a signed copy if the school wants one." }),
    t(4, { title: "Check the car seat height and weight limits", assigneeId: partner, dueOn: addDays(now, 4), detail: "Keep the harness until your child outgrows the seat's limits, not just an age." }),
    t(5, { title: "Sign up for swim lessons", assigneeId: mother, dueOn: addDays(now, 20), detail: "Lessons help, but a child near water still needs an adult within arm's reach." }),
    t(6, { title: "Update the emergency contacts at preschool", assigneeId: mother, dueOn: addDays(now, -4), done: true }),
  ];
}

function seed(family: Family): Task[] {
  const stage = olderStage(family);
  if (stage) return seedOlder(family, stage);
  const mother = family.parents.find((p) => p.role === "mother")!.id;
  const partner = family.parents.find((p) => p.role === "partner")!.id;
  let n = 0;
  const due = family.dueDate ?? addDays(today(), 105);
  const now = today();
  const t = (o: Partial<Task> & Pick<Task, "title" | "assigneeId">): Task => ({ id: taskId(family.id, ++n), kind: "task", done: false, ...o });
  const paper = (o: Omit<Parameters<typeof t>[0], "kind" | "dueOn"> & { offset: number; anchor?: "due_date" | "birth_date" }): Task => {
    const { offset, anchor = "due_date", ...rest } = o;
    return t({ ...rest, kind: "paperwork", dueAnchor: anchor, dueOffsetDays: offset, dueOn: addDays(due, offset) });
  };
  const bag = (b: "mother" | "partner" | "baby", assigneeId: string, titles: string[], packed = 0) =>
    titles.map((title, i) => t({ title, assigneeId, kind: "hospital_bag", bag: b, done: i < packed }));

  return [
    // These two are also on the calendar and Today: keep their positions (taskPlan.n).
    t({ title: taskPlan.birthClass.title, assigneeId: partner, dueOn: dayOf(taskPlan.birthClass.day) }),
    t({ title: taskPlan.pediatrician.title, assigneeId: mother, dueOn: dayOf(taskPlan.pediatrician.day), detail: "Ask your obstetrician for names, then check that each practice takes your insurance." }),
    t({ title: "Call the insurer about the hospital stay", assigneeId: partner, pendingAssigneeId: mother, dueOn: addDays(now, 21), detail: "Ask what a two night stay costs and whether the hospital is in network." }),
    t({ title: "Install the car seat", assigneeId: partner, dueOn: addDays(due, -28), detail: "Many fire stations and hospitals check the install for free." }),
    t({ title: "Plan leave dates with your employer", assigneeId: mother }),
    t({ title: events.birthCenterTour.title, assigneeId: partner, dueOn: dayOf(events.birthCenterTour.day) }),
    t({ title: "Choose the hospital", assigneeId: mother, dueOn: addDays(now, -6), done: true }),
    paper({ title: "Tell HR about your leave", assigneeId: mother, offset: -109, detail: "FMLA asks for 30 days notice when the leave is foreseeable.", source: DOL }),
    paper({ title: "Check that the hospital is in network", assigneeId: partner, offset: -84, source: HEALTHCARE }),
    paper({ title: "Pre-register at the hospital", assigneeId: mother, offset: -49 }),
    paper({ title: "Order copies of the birth certificate", assigneeId: partner, offset: 10, anchor: "birth_date" }),
    paper({ title: "Apply for the baby's Social Security number", assigneeId: partner, offset: 14, anchor: "birth_date", detail: "You can ask for it on the hospital's birth certificate form. The card arrives by mail in about two weeks.", source: SSA }),
    paper({ title: "Add the baby to your health insurance", assigneeId: mother, offset: 30, anchor: "birth_date", detail: "Most plans give 30 days after birth to add a newborn.", source: HEALTHCARE }),
    ...bag("mother", mother, ["ID and insurance card", "Nursing bras", "Robe and slippers", "Phone charger", "Toiletries", "Going-home outfit"], 3),
    ...bag("partner", partner, ["Snacks and water", "Change of clothes", "Phone charger", "Cash for parking"], 1),
    ...bag("baby", partner, ["Going-home outfit", "Swaddle blankets", "Newborn diapers"]),
    ...bag("baby", mother, ["Car seat installed"]),
  ];
}

async function tasksOf(family: () => Promise<Family>): Promise<Task[]> {
  const f = await family();
  if (!store.has(f.id)) {
    const tasks = seed(f);
    tasks.forEach((t) => seeded.add(t.id));
    store.set(f.id, tasks);
  }
  return store.get(f.id)!;
}

const byDue = (a: Task, b: Task) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999");
const find = (all: Task[], id: string) => {
  const task = all.find((x) => x.id === id);
  if (!task) throw new Error(`mock task ${id} not found`);
  return task;
};

export const taskMocks = {
  ...mock("/members/{memberId}/tasks", "get", async (ctx) => {
    const kind = ctx.query.kind;
    const loss = inLossSupport(await ctx.family());
    return { items: (await tasksOf(ctx.family)).filter((x) => (!kind || x.kind === kind) && !(loss && seeded.has(x.id))).sort(byDue) };
  }),
  ...mock("/members/{memberId}/tasks", "post", async (ctx) => {
    const all = await tasksOf(ctx.family);
    const task: Task = {
      id: taskId((await ctx.family()).id, all.length + 1),
      title: ctx.body.title,
      dueOn: ctx.body.dueOn,
      assigneeId: ctx.path.memberId,
      kind: ctx.body.kind ?? "task",
      bag: ctx.body.bag,
      detail: ctx.body.detail,
      done: false,
    };
    all.push(task);
    return task;
  }),
  ...mock("/members/{memberId}/tasks/{taskId}", "patch", async (ctx) => {
    const task = find(await tasksOf(ctx.family), ctx.path.taskId);
    task.done = ctx.body.done;
    task.doneAt = ctx.body.done ? new Date().toISOString() : undefined;
    task.doneById = ctx.body.done ? ctx.path.memberId : undefined;
    return { ...task };
  }),
  ...mock(
    "/members/{memberId}/tasks/{taskId}/reassignment",
    "post",
    async (ctx) => {
      const task = find(await tasksOf(ctx.family), ctx.path.taskId);
      task.pendingAssigneeId = ctx.body.toMemberId;
      return { ...task };
    },
    200,
  ),
  ...mock("/members/{memberId}/tasks/{taskId}/reassignment/accept", "post", async (ctx) => {
    const task = find(await tasksOf(ctx.family), ctx.path.taskId);
    task.assigneeId = ctx.path.memberId;
    task.pendingAssigneeId = undefined;
    return { ...task };
  }, 200),
  ...mock("/members/{memberId}/tasks/{taskId}/reassignment/decline", "post", async (ctx) => {
    const task = find(await tasksOf(ctx.family), ctx.path.taskId);
    task.pendingAssigneeId = undefined;
    return { ...task };
  }, 200),
};
