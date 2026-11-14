import { mock } from "../registry";
import { afterBirth, couple, dayOf, isNewborn, newbornTeam, olderStage } from "../timeline";

// Preview data for the care log, handoffs and the baby card. Times are relative
// to now so "last fed 95 minutes ago" always reads right. Writes are echoed, not
// stored: a mock cannot share state between the server render and the browser.
const min = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const ME = "00000000-0000-4000-8000-000000000001";
const CHILD = "00000000-0000-4000-8000-0000000000c1";
const VOICE_NOTE = "00000000-0000-4000-8000-0000000000e2";

function entries(child = CHILD, author = ME) {
  const e = (kind: "feed" | "sleep" | "diaper", ago: number, extra: Record<string, unknown> = {}, dur?: number) => ({
    id: `00000000-0000-4000-8000-${String(Math.round(ago)).padStart(12, "0")}`,
    childId: child,
    authorId: author,
    kind,
    startedAt: min(ago),
    endedAt: dur ? min(ago - dur) : undefined,
    createdAt: min(ago),
    ...extra,
  });
  return [
    e("sleep", 70, {}, 40),
    e("feed", 95, { feedMethod: "breast_right" as const }),
    e("diaper", 120, { diaper: "dirty" as const }),
    e("sleep", 330, {}, 90),
    e("diaper", 300, { diaper: "both" as const }),
    e("feed", 250, { feedMethod: "bottle_breast_milk" as const, amountMl: 80 }),
    e("feed", 430, { feedMethod: "bottle_formula" as const, amountMl: 90 }),
    e("sleep", 520, {}, 70),
    e("diaper", 560, { diaper: "wet" as const }),
    e("feed", 600, { feedMethod: "breast_left" as const }),
  ];
}

export const babyMocks = {
  // The newborn family logs as its two parents: the night block is Marcus's
  // until midnight and Aisha's after, so whoever is on duty is one of them, and
  // the entries are Leo's own. Caregivers and the other families keep the generic log.
  ...mock("/members/{memberId}/care-log", "get", async (ctx) => {
    const family = await ctx.family();
    const newborn = isNewborn(family) && family.children[0];
    const items = newborn ? entries(family.children[0].id, ctx.path.memberId) : entries();
    const last = (k: string) => items.find((i) => i.kind === k);
    return {
      items,
      latest: {
        lastFeed: last("feed"),
        lastSleep: last("sleep"),
        lastDiaper: last("diaper"),
        onDuty: { memberId: newborn ? couple(family).mother.id : ctx.path.memberId, since: min(300), via: "shift" as const },
      },
    };
  }),
  ...mock("/members/{memberId}/care-log", "post", (ctx) => ({
    id: crypto.randomUUID(),
    childId: ctx.body.childId ?? CHILD,
    authorId: ctx.path.memberId,
    kind: ctx.body.kind,
    startedAt: ctx.body.startedAt,
    endedAt: ctx.body.endedAt,
    feedMethod: ctx.body.feedMethod,
    amountMl: ctx.body.amountMl,
    diaper: ctx.body.diaper,
    note: ctx.body.note,
    createdAt: new Date().toISOString(),
  })),
  // A caregiver who logs care sees one handoff from the partner waiting, with a
  // voice note, so the receiving card and its player show. Parents see none and
  // keep the form. The audio itself is not mocked (it is not JSON); the player
  // shows its "will not play" state until getVoiceNote works.
  ...mock("/members/{memberId}/handoffs", "get", async (ctx) => {
    const family = await ctx.family();
    // The newborn parents hand Leo over to each other at night: Aisha waits for Marcus
    // with her note (no voice note), so Marcus sees the receiving card and Aisha her own.
    if (isNewborn(family) && family.children[0]) {
      const { mother, partner } = couple(family);
      const parentItems = entries(family.children[0].id, mother.id);
      const lastOf = (k: string) => parentItems.find((i) => i.kind === k);
      return {
        items: [
          {
            id: "00000000-0000-4000-8000-0000000000e3",
            fromMemberId: mother.id,
            toMemberId: partner.id,
            note: "Leo fed on the right side and is asleep. Burp him after the next feed. Spare muslins are on the dresser.",
            status: "pending" as const,
            createdAt: min(8),
            careSummary: { lastFeed: lastOf("feed"), lastSleep: lastOf("sleep"), lastDiaper: lastOf("diaper") },
          },
        ],
      };
    }
    const me = family.caregivers?.find((c) => c.id === ctx.path.memberId);
    if (!me?.permissions.includes("care_log")) return { items: [] };
    const items = entries();
    const last = (k: string) => items.find((i) => i.kind === k);
    return {
      items: [
        {
          id: "00000000-0000-4000-8000-0000000000e1",
          fromMemberId: couple(family).partner.id,
          toMemberId: me.id,
          note: "Fed at the last feed time below, napping now. Cream is on the changing table.",
          status: "pending" as const,
          createdAt: min(5),
          careSummary: { lastFeed: last("feed"), lastSleep: last("sleep"), lastDiaper: last("diaper") },
          voiceNote: { id: VOICE_NOTE, contentType: "audio/webm", sizeBytes: 96_000, durationSeconds: 14, createdAt: min(6) },
        },
      ],
    };
  }),
  ...mock("/members/{memberId}/handoffs", "post", (ctx) => ({
    id: crypto.randomUUID(),
    fromMemberId: ctx.path.memberId,
    toMemberId: ctx.body.toMemberId,
    note: ctx.body.note,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    careSummary: {},
    voiceNote: ctx.body.voiceNoteId ? { id: ctx.body.voiceNoteId, contentType: "audio/webm", sizeBytes: 0, createdAt: new Date().toISOString() } : undefined,
  })),
  // The bytes are not kept: the upload answers with the note's id and length only.
  ...mock("/members/{memberId}/voice-notes", "post", (ctx) => ({
    id: crypto.randomUUID(),
    contentType: "audio/webm",
    sizeBytes: 0,
    durationSeconds: ctx.query.durationSeconds ? Number(ctx.query.durationSeconds) : undefined,
    createdAt: new Date().toISOString(),
  })),
  ...mock("/members/{memberId}/children/{childId}/passport", "get", async (ctx) => {
    const family = await ctx.family();
    const child = family.children.find((c) => c.id === ctx.path.childId);
    const { mother, partner } = couple(family);
    const other = ctx.path.memberId === mother.id ? partner : mother;
    // The preschool child gets its own pediatrician (seed: Dr. Nadia Rahman).
    if (child && olderStage(family) === "child") {
      return {
        child,
        limitedView: false,
        pediatrician: { id: "00000000-0000-4000-8000-0000000000d2", name: "Dr. Nadia Rahman", role: "pediatrician" as const, clinic: "Foothills Children's Clinic", phone: "(720) 555-0147" },
        allergies: [],
        emergencyContacts: [{ name: partner.displayName, relation: "Parent", phone: "(555) 010-3377" }],
        medicalHistory: [],
      };
    }
    // Leo, as the real passport has him: Dr. Ortiz, no allergies, hepatitis B at birth.
    // The 2-month doses are the seed's scheduled doses, so this card, the passport and
    // the plan all say the same. A nanny or grandparent sees the limited view.
    const dose = (id: number, name: string) => ({ id: `00000000-0000-4000-8000-0000000000b${id}`, name, dose: "Dose 1", status: "due" as const, dueOn: afterBirth(family, 2), visibility: "family" as const });
    const caregiver = family.caregivers?.some((c) => c.id === ctx.path.memberId);
    return {
      child: child ?? { id: ctx.path.childId, name: "Leo", birthDate: dayOf(-49), ageMonths: 1 },
      limitedView: !!caregiver,
      pediatrician: { id: "00000000-0000-4000-8000-0000000000d1", name: newbornTeam.pediatrician.name, role: "pediatrician" as const, clinic: newbornTeam.pediatrician.clinic, phone: newbornTeam.pediatrician.phone },
      allergies: [],
      emergencyContacts: [{ name: other.displayName, relation: "Parent", phone: other.id === mother.id ? "(617) 555-0111" : "(617) 555-0112" }],
      medicalHistory: [],
      ...(caregiver
        ? {}
        : {
            vaccines: [
              { id: "00000000-0000-4000-8000-0000000000b1", name: "Hepatitis B", dose: "", status: "done" as const, givenOn: child?.birthDate ?? dayOf(-49), visibility: "family" as const },
              dose(2, "DTaP"),
              dose(3, "Polio"),
              dose(4, "Hib"),
              dose(5, "Pneumococcal"),
              dose(6, "Rotavirus"),
            ],
          }),
    };
  }),
};
