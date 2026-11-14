import { mock } from "../registry";
import { isoAt, uid } from "./dates";

const obVisit = uid(600);
const scan = uid(601);

// Two upcoming appointments, one question carried over from a visit that already happened.
export const appointmentQuestionMocks = {
  ...mock("/members/{memberId}/appointment-questions", "get", (ctx) => ({
    appointments: [
      { id: obVisit, kind: "appointment", title: "Prenatal visit with Dr. Reyes", startsAt: isoAt(5, 16), endsAt: isoAt(5, 16, 30), allDay: false, location: "Lakeside Women's Health", ownerId: ctx.path.memberId, attendeeIds: [ctx.path.memberId], visibility: "family" },
      { id: scan, kind: "appointment", title: "Anatomy follow-up scan", startsAt: isoAt(19, 18), endsAt: isoAt(19, 19), allDay: false, location: "Lakeside Women's Health", ownerId: ctx.path.memberId, attendeeIds: [ctx.path.memberId], visibility: "family" },
    ],
    items: [
      { id: uid(610), authorId: ctx.path.memberId, text: "Is the glucose screen fasting or not?", appointmentId: obVisit, askedForAppointmentId: obVisit, carriedOver: false, answered: false, visibility: "partner", createdAt: isoAt(-2, 19) },
      { id: uid(611), authorId: ctx.path.memberId, text: "Can I keep running at 25 weeks?", appointmentId: obVisit, askedForAppointmentId: obVisit, carriedOver: false, answered: false, visibility: "private", createdAt: isoAt(-1, 8) },
      { id: uid(612), authorId: ctx.path.memberId, text: "When should we start the hospital tour?", appointmentId: obVisit, askedForAppointmentId: uid(609), carriedOver: true, answered: false, visibility: "partner", createdAt: isoAt(-21, 12) },
      { id: uid(613), authorId: ctx.path.memberId, text: "Is mild back pain normal this week?", appointmentId: scan, askedForAppointmentId: scan, carriedOver: false, answered: true, answer: "Common now. Heat and a support belt help; call if it comes in waves.", answeredAt: isoAt(-14, 17), visibility: "private", createdAt: isoAt(-25, 10) },
    ],
  })),
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
