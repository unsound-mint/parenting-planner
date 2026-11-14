import { mock } from "../registry";
import { isoAt, uid } from "./dates";

const provider = {
  id: uid(400),
  name: "Dr. Anna Weiss",
  credentials: "PhD, licensed clinical psychologist",
  focus: "Perinatal and postpartum mental health",
};

// Agenda with topics and no booked session, so the slot picker shows.
// The slots, booking and note endpoints answer with plausible bodies; nothing is stored.
export const careMocks = {
  ...mock("/members/{memberId}/psychologist-agenda", "get", () => ({
    topics: [
      { id: uid(410), text: "Sleeping badly since week 22", addedAt: isoAt(-5, 20) },
      { id: uid(411), text: "Worried about going back to work after leave", addedAt: isoAt(-3, 9) },
      { id: uid(412), text: "How to split night shifts with Jake", addedAt: isoAt(-1, 21) },
    ],
  })),
  ...mock("/members/{memberId}/psychologist-slots", "get", () => ({
    provider,
    items: [
      { id: uid(420), startsAt: isoAt(2, 15), durationMinutes: 50 },
      { id: uid(421), startsAt: isoAt(3, 17), durationMinutes: 50 },
      { id: uid(422), startsAt: isoAt(5, 14), durationMinutes: 50 },
      { id: uid(423), startsAt: isoAt(6, 16), durationMinutes: 50 },
      { id: uid(424), startsAt: isoAt(9, 15), durationMinutes: 50 },
    ],
  })),
  ...mock("/members/{memberId}/psychologist-bookings", "post", () => ({
    id: uid(430),
    provider,
    startsAt: isoAt(2, 15),
    durationMinutes: 50,
    noteWritten: false,
  })),
  ...mock("/members/{memberId}/session-notes", "post", (ctx) => ({
    id: uid(440),
    bookingId: ctx.body.bookingId,
    writtenAt: new Date().toISOString(),
    text: ctx.body.text,
  })),
};
