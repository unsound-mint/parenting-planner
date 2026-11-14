import { mock } from "../registry";

// Preview for adding and editing a calendar event. Nothing is stored: the
// answer echoes the input so the form can close, and the screen says so.
export const calendarEventMocks = {
  ...mock("/members/{memberId}/calendar-events", "post", (ctx) => ({
    id: crypto.randomUUID(),
    kind: ctx.body.kind,
    title: ctx.body.title,
    startsAt: ctx.body.startsAt,
    ...(ctx.body.endsAt ? { endsAt: ctx.body.endsAt } : {}),
    allDay: ctx.body.allDay ?? false,
    ...(ctx.body.location ? { location: ctx.body.location } : {}),
    ownerId: ctx.path.memberId,
    attendeeIds: ctx.body.attendeeIds ?? [],
    visibility: ctx.body.visibility,
    neutralTitle: ctx.body.neutralTitle ?? false,
  })),
  ...mock("/members/{memberId}/calendar-events/{eventId}", "patch", (ctx) => ({
    id: ctx.path.eventId,
    kind: "appointment" as const,
    title: ctx.body.title ?? "Event",
    startsAt: ctx.body.startsAt ?? new Date().toISOString(),
    allDay: ctx.body.allDay ?? false,
    ownerId: ctx.path.memberId,
    attendeeIds: ctx.body.attendeeIds ?? [],
    visibility: ctx.body.visibility ?? "private",
    neutralTitle: ctx.body.neutralTitle ?? false,
  })),
  ...mock("/members/{memberId}/calendar-events/{eventId}", "delete", () => undefined as never, 204),
};
