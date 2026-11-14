import type { AppointmentQuestion } from "@/lib/api/types";
import { inLossSupport } from "@/lib/loss";
import { mock } from "../registry";
import { isoAt, uid } from "./dates";
import { mockNow } from "@/lib/clock";
import { calendarEvent, couple, events, lastVisit } from "../timeline";

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

// Two upcoming appointments (from the shared timeline), one question carried over from a visit that already happened.
export const appointmentQuestionMocks = {
  ...mock("/members/{memberId}/appointment-questions", "get", async (ctx) => {
    const family = await ctx.family();
    // Every demo question is about the pregnancy; loss support shows none.
    if (inLossSupport(family)) return { appointments: [], items: [] };
    const c = couple(family);
    // As the real list does: an unanswered question of a visit that has passed moves
    // to the next upcoming visit of the same kind (carried over), or to none.
    const now = mockNow().getTime();
    const visits = [events.prenatalVisit, events.tdapVisit, events.anatomyScan].map((e) => calendarEvent(e, c));
    const startsAt = (id: string) => Date.parse(visits.find((v) => v.id === id)?.startsAt ?? "");
    const next = (id: string) => (id === obVisit ? visits.find((v) => v.id === events.tdapVisit.id && startsAt(v.id) > now)?.id : undefined);
    const items = demoQuestions(ctx.path.memberId).map((q): AppointmentQuestion => {
      if (q.answered || !q.appointmentId || startsAt(q.appointmentId) > now) return q;
      const moved = next(q.appointmentId);
      return { ...q, appointmentId: moved, carriedOver: moved !== q.askedForAppointmentId };
    });
    return { appointments: visits.filter((v) => items.some((q) => q.appointmentId === v.id)), items };
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
