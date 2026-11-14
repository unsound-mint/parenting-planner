import type { components } from "@/lib/api/schema.gen";
import { mock } from "../registry";
import { isoAt, isoDate, uid } from "./dates";

type Provider = components["schemas"]["Provider"];

// Made-up providers, sorted soonest first like the API does.
const providers = (): Provider[] =>
  [
    { id: uid(500), name: "Dr. Priya Nair", type: "perinatal_therapist", city: "Oakland", state: "CA", languages: ["English", "Hindi"], nextAvailable: isoDate(2), priceUsd: 140, summary: "Helps expecting parents with low mood, worry and sleep." },
    { id: uid(501), name: "Marcus Bell, LMFT", type: "perinatal_therapist", city: "Sacramento", state: "CA", languages: ["English"], nextAvailable: isoDate(4), priceUsd: 120, summary: "Couples and individual sessions before and after the birth." },
    { id: uid(502), name: "Dr. Anna Weiss", type: "psychologist", city: "San Francisco", state: "CA", languages: ["English", "German"], nextAvailable: isoDate(3), priceUsd: 185, summary: "Perinatal and postpartum mental health, one parent at a time." },
    { id: uid(503), name: "Rosa Alvarez", type: "doula", city: "San Jose", state: "CA", languages: ["English", "Spanish"], nextAvailable: isoDate(6), priceUsd: 90, summary: "Birth planning and support through labor and the first week home." },
    { id: uid(504), name: "Hannah Cole, IBCLC", type: "lactation_consultant", city: "Oakland", state: "CA", languages: ["English"], nextAvailable: isoDate(8), priceUsd: 110, summary: "Latch and feeding help, in the home or by video." },
    { id: uid(505), name: "Tom Brennan", type: "sleep_consultant", city: "Austin", state: "TX", languages: ["English"], nextAvailable: isoDate(12), priceUsd: 95, summary: "Gentle sleep plans for babies from four months." },
    { id: uid(506), name: "Dr. Lena Ortiz", type: "child_therapist", city: "Austin", state: "TX", languages: ["English", "Spanish"], nextAvailable: isoDate(15), priceUsd: 130, summary: "Play-based therapy for children from three to nine." },
    { id: uid(507), name: "Ben Okoye", type: "tutor", city: "Brooklyn", state: "NY", languages: ["English"], nextAvailable: isoDate(5), priceUsd: 60, summary: "Early reading and maths for ages five to nine." },
  ].sort((a, b) => a.nextAvailable.localeCompare(b.nextAvailable)) as Provider[];

export const directoryMocks = {
  ...mock("/providers", "get", (ctx) => ({
    items: providers().filter((p) => (!ctx.query.type || p.type === ctx.query.type) && (!ctx.query.state || p.state === ctx.query.state)),
  })),
  ...mock("/members/{memberId}/booking-requests", "get", (ctx) => ({
    items: [{ id: uid(510), memberId: ctx.path.memberId, providerId: uid(502), status: "requested", note: "Evenings work best.", createdAt: isoAt(-1, 18) }],
  })),
  ...mock("/members/{memberId}/booking-requests", "post", (ctx) => ({
    id: uid(511),
    memberId: ctx.path.memberId,
    providerId: ctx.body.providerId,
    status: "requested",
    note: ctx.body.note,
    createdAt: new Date().toISOString(),
  })),
};
