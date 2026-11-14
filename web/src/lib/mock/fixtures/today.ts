import type { components } from "@/lib/api/schema.gen";
import { inLossSupport } from "@/lib/loss";
import { mock } from "../registry";
import { at, calendarEvent, couple, dayOf, events, taskId, taskPlan } from "../timeline";

type Guide = components["schemas"]["Guide"];

// Preview data for the home screen: the weekly pregnancy card, stage guides and
// Today. It follows the demo family (Emily, week 25, due 2027-02-27, partner
// Jake, a grandparent and a nanny). Events and tasks come from the shared timeline
// (lib/mock/timeline.ts); the guides are the same for everyone.

const DEMO_WEEK = 25;
const source = { title: "ACOG patient education (summarized)", url: "https://www.acog.org/womens-health", checkedAt: "2026-11-10" };

const birthPrep = (week: number): Guide[] =>
  [
    { id: "birth-prep-breathing", title: "Breathing for labor", summary: "A slow breath you can practice now, together.", steps: ["Breathe in through the nose for four counts.", "Out through the mouth for six.", "Ten rounds, once a day."], minutes: 5 },
    { id: "birth-prep-positions", title: "Positions for labor", summary: "Four positions to try with your partner.", steps: ["Hands and knees.", "Standing, leaning on your partner.", "Side lying with a pillow between the knees.", "Sitting on a birth ball."], minutes: 6 },
  ].map((g) => ({
    ...g,
    kind: "birth_prep" as const,
    stages: ["pregnancy" as const],
    weekFrom: 28,
    audience: ["mother" as const, "partner" as const],
    locked: week < 32,
    unlocksAtWeek: 32,
    source,
  }));

const articles: Guide[] = [
  { id: "hospital-bag", title: "Packing the hospital bag", summary: "Pack by week 36; the list is short.", steps: ["Documents and insurance card.", "Phone charger.", "Going-home outfit for the baby."], minutes: 4 },
  { id: "choose-pediatrician", title: "Choosing a pediatrician", summary: "Visit two or three before the due date.", steps: ["Ask friends and your OB for names.", "Check that your insurance covers them.", "Book a short meet-and-greet."], minutes: 3 },
].map((g) => ({ ...g, kind: "article" as const, stages: ["pregnancy" as const], weekFrom: 24, weekTo: 30, audience: ["mother" as const, "partner" as const], locked: false, source }));

export const todayMocks = {
  ...mock("/members/{memberId}/pregnancy-weeks/{week}", "get", (ctx) => {
    const week = Number(ctx.path.week);
    return {
      week,
      isCurrentWeek: week === DEMO_WEEK,
      whyItMatters:
        "Your baby is gaining weight and practicing breathing movements. Counting kicks gives you a baseline to bring to your next visit.",
      tasks: ["Count kicks for an hour after dinner and write the number down.", "Book the glucose screening with your OB."],
      questions: ["How will I know labor has started?", "Which signs mean I should call you right away?"],
      birthPrep: birthPrep(DEMO_WEEK),
      source,
    };
  }),

  ...mock("/members/{memberId}/guides", "get", (ctx) => ({
    items: ctx.query.kind === "birth_prep" ? birthPrep(DEMO_WEEK) : articles,
  })),

  ...mock("/members/{memberId}/family", "patch", (ctx) => ({
    id: "00000000-0000-4000-8000-000000000001",
    template: "pregnancy",
    stage: ctx.body.stage ?? "pregnancy",
    dueDate: ctx.body.dueDate ?? "2027-02-27",
    gestationalWeek: DEMO_WEEK,
    parents: [],
    caregivers: [],
    children: [],
  })),

  ...mock("/members/{memberId}/today", "get", async (ctx) => {
    const memberId = ctx.path.memberId;
    const family = await ctx.family();
    const c = couple(family);
    const role = memberId === c.partner.id ? "partner" : "mother";
    // Both demo tasks and the visit are pregnancy prep; loss support hides them.
    const loss = inLossSupport(family);
    const mine = loss ? [] : Object.values(taskPlan).filter((t) => c[t.owner].id === memberId);
    return {
      memberId,
      role,
      date: dayOf(0),
      stage: family.stage,
      planItems: [],
      tasks: mine.map((t) => ({ id: taskId(family.id, t.n), title: t.title, assigneeId: memberId, kind: "task" as const, done: false, dueOn: dayOf(t.day) })),
      events: loss ? [] : [calendarEvent(events.prenatalVisit, c)],
      nextShift: { id: "shift-next", kind: "shift", title: "Nanny shift", startsAt: at(1, "08:00"), endsAt: at(1, "16:00"), allDay: false, attendeeIds: [memberId], visibility: "family" },
      careSummary: { onDuty: { memberId, since: at(0, "08:00"), via: "shift" } },
      pendingHandoffs: [],
      guides: [],
    };
  }),
};
