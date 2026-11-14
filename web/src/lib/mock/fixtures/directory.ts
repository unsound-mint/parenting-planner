import type { components } from "@/lib/api/schema.gen";
import { mock } from "../registry";
import { isoAt, uid } from "./dates";

type Provider = components["schemas"]["Provider"];
type Slot = components["schemas"]["ProviderSlot"];

const p = (n: number, name: string, type: Provider["type"], city: string, state: string, languages: string[], priceUsd: number, summary: string, visitModes: Provider["visitModes"]): Provider => ({
  id: uid(n),
  name,
  type,
  city,
  state,
  languages,
  priceUsd,
  summary,
  credentials: "Licensed",
  bio: summary + " A made-up provider for previews.",
  visitModes,
  sessionMinutes: 50,
});

// Made-up providers, sorted by name like the API does.
const providers = (): Provider[] =>
  [
    p(500, "Dr. Priya Nair", "perinatal_therapist", "Austin", "TX", ["English", "Hindi"], 140, "Helps expecting parents with low mood, worry and sleep.", ["in_person", "video"]),
    p(501, "Noah Bell, LMFT", "perinatal_therapist", "Houston", "TX", ["English"], 120, "Couples and individual sessions before and after the birth.", ["video"]),
    p(502, "Dr. Anna Weiss", "psychologist", "Austin", "TX", ["English", "German"], 185, "Perinatal and postpartum mental health, one parent at a time.", ["video"]),
    p(503, "Rosa Alvarez", "doula", "Austin", "TX", ["English", "Spanish"], 90, "Birth planning and support through labor and the first week home.", ["in_person", "home"]),
    p(504, "Hannah Cole, IBCLC", "lactation_consultant", "Austin", "TX", ["English"], 110, "Latch and feeding help, in the home or by video.", ["home", "video"]),
    p(505, "Tom Brennan", "sleep_consultant", "Austin", "TX", ["English"], 95, "Gentle sleep plans for babies from four months.", ["video"]),
    p(506, "Cedar Kids Clinic", "pediatrician", "Austin", "TX", ["English", "Spanish"], 160, "Pediatricians taking new patients, newborns included.", ["in_person"]),
    p(507, "Hill Country OB", "obstetrician", "Austin", "TX", ["English"], 220, "Prenatal care and birth.", ["in_person"]),
  ].sort((a, b) => a.name.localeCompare(b.name));

// Three times a weekday for each provider, starting on a different day per provider.
const slots = (): Slot[] =>
  providers()
    .flatMap((pr, i) => [1, 2, 3, 5, 8].flatMap((d) => [14, 15, 19].map((h, k) => ({ id: uid(600 + i * 100 + d * 10 + k), providerId: pr.id, startsAt: isoAt(d + (i % 3), h), durationMinutes: 50 }))))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

export const directoryMocks = {
  ...mock("/providers", "get", (ctx) => ({
    items: providers().filter((x) => (!ctx.query.type || x.type === ctx.query.type) && (!ctx.query.state || x.state === ctx.query.state)),
  })),
  ...mock("/members/{memberId}/provider-slots", "get", (ctx) => ({
    items: slots().filter((s) => !ctx.query.providerId || s.providerId === ctx.query.providerId).slice(1),
  })),
  ...mock("/members/{memberId}/provider-bookings", "get", (ctx) => ({
    items: [
      {
        id: uid(590),
        memberId: ctx.path.memberId,
        providerId: uid(503),
        providerName: "Rosa Alvarez",
        startsAt: slots().find((s) => s.providerId === uid(503))!.startsAt,
        durationMinutes: 50,
        visibility: "family",
        createdAt: isoAt(-1, 18),
      },
    ],
  })),
};
