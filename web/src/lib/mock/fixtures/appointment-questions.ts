import type { AppointmentQuestion, Family } from "@/lib/api/types";
import { inLossSupport } from "@/lib/loss";
import { mock } from "../registry";
import { isoAt, uid } from "./dates";
import { calendarEvent, childEvents, couple, events, lastVisit, olderStage, planningEvents, type Couple } from "../timeline";

const obVisit = events.prenatalVisit.id;
const scan = events.anatomyScan.id;

/** The demo questions, shared with the appointment prep mock so both views list the same ones. */
export function demoQuestions(memberId: string): AppointmentQuestion[] {
  return [
    { id: uid(610), authorId: memberId, text: "Is the glucose screen fasting or not?", appointmentId: obVisit, askedForAppointmentId: obVisit, carriedOver: false, answered: false, visibility: "partner", createdAt: isoAt(-2, 19) },
    { id: uid(611), authorId: memberId, text: "Can I keep running at 25 weeks?", appointmentId: obVisit, askedForAppointmentId: obVisit, carriedOver: false, answered: false, visibility: "private", createdAt: isoAt(-1, 8) },
    { id: uid(612), authorId: memberId, text: "How do we know when to leave for the hospital?", appointmentId: obVisit, askedForAppointmentId: lastVisit.id, carriedOver: true, answered: false, visibility: "partner", createdAt: isoAt(-21, 12) },
    { id: uid(613), authorId: memberId, text: "Is mild back pain normal this week?", appointmentId: scan, askedForAppointmentId: scan, carriedOver: false, answered: true, answer: "Common now. Heat and a support belt help; call if it comes in waves.", answeredAt: isoAt(-14, 17), visibility: "private", createdAt: isoAt(-25, 10) },
  ];
}

// The next visits and the questions parents saved for them, per older stage.
function older(stage: "planning" | "child", family: Family, c: Couple, me: string) {
  const q = (n: number, o: Pick<AppointmentQuestion, "text" | "appointmentId" | "askedForAppointmentId" | "visibility"> & Partial<AppointmentQuestion>): AppointmentQuestion => ({
    id: uid(640 + n),
    authorId: me,
    carriedOver: false,
    answered: false,
    createdAt: isoAt(-n, 19),
    ...o,
  });
  if (stage === "planning") {
    const visit = planningEvents.preconceptionVisit.id;
    const shot = planningEvents.mmrShot.id;
    return {
      appointments: [calendarEvent(planningEvents.mmrShot, c), calendarEvent(planningEvents.preconceptionVisit, c)],
      items: [
        q(1, { text: "Can I get the flu shot at the same visit?", appointmentId: shot, askedForAppointmentId: shot, visibility: "private" }),
        q(2, { text: "Should I take anything besides folic acid?", appointmentId: visit, askedForAppointmentId: visit, visibility: "partner" }),
        q(3, { text: "Do we need carrier screening, and will insurance pay for it?", appointmentId: visit, askedForAppointmentId: visit, visibility: "partner" }),
        q(4, { text: "How long after the MMR shot should we wait to try?", appointmentId: visit, askedForAppointmentId: lastVisit.id, carriedOver: true, visibility: "partner" }),
      ],
    };
  }
  const visit = childEvents.checkup.id;
  return {
    appointments: [calendarEvent(childEvents.checkup, c)],
    items: [
      q(1, { text: "Is the vision screen part of the check-up?", appointmentId: visit, askedForAppointmentId: visit, visibility: "partner" }),
      q(2, { text: "Which boosters are due before kindergarten?", appointmentId: visit, askedForAppointmentId: visit, visibility: "partner" }),
      q(3, { text: `Is it normal that ${family.children[0]?.name ?? "she"} still wakes at night sometimes?`, appointmentId: visit, askedForAppointmentId: lastVisit.id, carriedOver: true, visibility: "private" }),
    ],
  };
}

// Two upcoming appointments (from the shared timeline), one question carried over from a visit that already happened.
export const appointmentQuestionMocks = {
  ...mock("/members/{memberId}/appointment-questions", "get", async (ctx) => {
    const family = await ctx.family();
    // Every demo question is about the pregnancy; loss support shows none.
    if (inLossSupport(family)) return { appointments: [], items: [] };
    const c = couple(family);
    const stage = olderStage(family);
    if (stage) return older(stage, family, c, ctx.path.memberId);
    return {
    appointments: [calendarEvent(events.prenatalVisit, c), calendarEvent(events.anatomyScan, c)],
    items: demoQuestions(ctx.path.memberId),
    };
  }),
  ...mock("/members/{memberId}/appointment-questions", "post", (ctx) => ({
    id: uid(620),
    authorId: ctx.path.memberId,
    text: ctx.body.text,
    appointmentId: ctx.body.appointmentId ?? obVisit,
    askedForAppointmentId: ctx.body.appointmentId ?? obVisit,
    carriedOver: false,
    answered: false,
    visibility: ctx.body.visibility,
    createdAt: new Date().toISOString(),
  })),
  ...mock("/members/{memberId}/appointment-questions/{questionId}", "patch", (ctx) => ({
    id: ctx.path.questionId,
    authorId: ctx.path.memberId,
    text: "Is the glucose screen fasting or not?",
    appointmentId: obVisit,
    askedForAppointmentId: obVisit,
    carriedOver: false,
    answered: ctx.body.answered,
    answer: ctx.body.answer,
    visibility: "partner",
    createdAt: isoAt(-2, 19),
  })),
};
