import type { Milestone, MilestoneDomain } from "@/lib/api/types";
import { mock } from "../registry";
import { dayOf } from "../timeline";

// The CDC "Learn the Signs. Act Early." checklist for 4 years, as on
// https://www.cdc.gov/act-early/milestones/4-years.html (opened 2026-11-14, page
// reviewed 2026-05-16). The real endpoint picks the 2, 3, 4 or 5 year list by
// age; the preview always shows the 4 year one. The wording keeps the CDC's.
const CHECKLIST: { id: string; domain: MilestoneDomain; text: string; seen?: number }[] = [
  { id: "4y-social-pretend", domain: "social_emotional", text: "Pretends to be something else during play (teacher, superhero, dog)", seen: -40 },
  { id: "4y-social-play", domain: "social_emotional", text: "Asks to go play with children if none are around", seen: -30 },
  { id: "4y-social-comfort", domain: "social_emotional", text: "Comforts others who are hurt or sad", seen: -12 },
  { id: "4y-social-danger", domain: "social_emotional", text: "Avoids danger, like not jumping from tall heights at the playground" },
  { id: "4y-social-helper", domain: "social_emotional", text: 'Likes to be a "helper"', seen: -20 },
  { id: "4y-social-places", domain: "social_emotional", text: "Changes behavior based on where she is (place of worship, library, playground)" },
  { id: "4y-language-sentences", domain: "language_communication", text: "Says sentences with four or more words", seen: -50 },
  { id: "4y-language-songs", domain: "language_communication", text: "Says some words from a song, story, or nursery rhyme", seen: -45 },
  { id: "4y-language-day", domain: "language_communication", text: "Talks about at least one thing that happened during her day" },
  { id: "4y-language-questions", domain: "language_communication", text: 'Answers simple questions like "What is a coat for?"' },
  { id: "4y-cognitive-colors", domain: "cognitive", text: "Names a few colors of items", seen: -60 },
  { id: "4y-cognitive-story", domain: "cognitive", text: "Tells what comes next in a well-known story" },
  { id: "4y-cognitive-draw", domain: "cognitive", text: "Draws a person with three or more body parts" },
  { id: "4y-movement-ball", domain: "movement_physical", text: "Catches a large ball most of the time", seen: -25 },
  { id: "4y-movement-pour", domain: "movement_physical", text: "Serves herself food or pours water, with adult supervision" },
  { id: "4y-movement-buttons", domain: "movement_physical", text: "Unbuttons some buttons" },
  { id: "4y-movement-pencil", domain: "movement_physical", text: "Holds crayon or pencil between fingers and thumb (not a fist)", seen: -15 },
];

const source = { title: "CDC: Milestones by 4 Years (Learn the Signs. Act Early.)", url: "https://www.cdc.gov/act-early/milestones/4-years.html", checkedAt: "2026-11-14" };

const item = (m: (typeof CHECKLIST)[number]): Milestone => ({
  id: m.id,
  domain: m.domain,
  text: m.text,
  observed: m.seen !== undefined,
  ...(m.seen !== undefined ? { observedOn: dayOf(m.seen) } : {}),
});

export const milestoneMocks = {
  ...mock("/members/{memberId}/children/{childId}/milestones", "get", (ctx) => ({
    childId: ctx.path.childId,
    checklistAgeMonths: 48,
    items: CHECKLIST.map(item),
    source,
  })),
  // Echoes the new value; nothing is stored, so a reload shows the seed again.
  ...mock("/members/{memberId}/children/{childId}/milestones/{milestoneId}", "put", (ctx) => {
    const m = CHECKLIST.find((x) => x.id === ctx.path.milestoneId) ?? CHECKLIST[0];
    return { id: m.id, domain: m.domain, text: m.text, observed: ctx.body.observed, ...(ctx.body.observed ? { observedOn: dayOf(0) } : {}) };
  }, 200),
};
