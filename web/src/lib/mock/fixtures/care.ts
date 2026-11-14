import { mock } from "../registry";
import { isoAt, uid } from "./dates";
import { at, careTeam, couple } from "../timeline";

const { id, name, credentials, focus } = careTeam.psychologist;
const provider = { id, name, credentials, focus };

function agendaTopics(family: Parameters<typeof couple>[0]) {
  const { partner } = couple(family);
  return [
    { id: uid(413), text: "Birth anxiety", addedAt: isoAt(-1, 22), diaryEntryId: uid(450) },
    { id: uid(410), text: "Sleeping badly since week 22", addedAt: isoAt(-5, 20) },
    { id: uid(411), text: "Worried about going back to work after leave", addedAt: isoAt(-3, 9) },
    { id: uid(412), text: `How to split night shifts with ${partner.displayName}`, addedAt: isoAt(-1, 21) },
  ];
}

// Agenda with topics and no booked session, so the slot picker shows.
// The slots, booking, note and agenda save endpoints answer with plausible
// bodies; nothing is stored, so a reload shows the original order again.
export const careMocks = {
  ...mock("/members/{memberId}/psychologist-agenda", "get", async (ctx) => ({
    topics: agendaTopics(await ctx.family()),
  })),
  // Echoes the saved order: the ids sent, in that order; the rest are removed.
  ...mock("/members/{memberId}/psychologist-agenda", "put", async (ctx) => {
    const topics = agendaTopics(await ctx.family());
    return { topics: ctx.body.topicIds.flatMap((id) => topics.filter((t) => t.id === id)) };
  }),
  ...mock("/members/{memberId}/psychologist-slots", "get", () => ({
    provider,
    items: [
      { id: uid(420), startsAt: at(2, "10:00"), durationMinutes: 50 },
      { id: uid(421), startsAt: at(3, "12:00"), durationMinutes: 50 },
      { id: uid(422), startsAt: at(5, "11:30"), durationMinutes: 50 },
      { id: uid(423), startsAt: at(7, "11:00"), durationMinutes: 50 },
      { id: uid(424), startsAt: at(9, "10:00"), durationMinutes: 50 },
    ],
  })),
  ...mock("/members/{memberId}/psychologist-bookings", "post", () => ({
    id: uid(430),
    provider,
    startsAt: at(2, "10:00"),
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
