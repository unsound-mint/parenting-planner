import type { CalendarFeed } from "@/lib/api/types";
import { mock } from "../registry";

// Preview data for the calendar subscription link. Like the real API, the URL
// comes back once, from the POST; later reads only say a link is active. State
// lives in memory per runtime and resets on reload. The preview host has no
// feed file behind the URL: it only shows how the link and the buttons look.
const store = new Map<string, CalendarFeed>();

export const calendarFeedMocks = {
  ...mock("/members/{memberId}/calendar-feed", "get", (ctx) => store.get(ctx.path.memberId) ?? { active: false }, 200),
  ...mock("/members/{memberId}/calendar-feed", "post", (ctx) => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    const createdAt = new Date().toISOString();
    store.set(ctx.path.memberId, { active: true, scope: ctx.body.scope, createdAt });
    return { active: true, scope: ctx.body.scope, createdAt, url: `https://parenting-planner.example/api/calendar-feeds/${token}` };
  }, 201),
  ...mock("/members/{memberId}/calendar-feed", "delete", (ctx) => {
    store.delete(ctx.path.memberId);
    return undefined as never;
  }, 204),
};
