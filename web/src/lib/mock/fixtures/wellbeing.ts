import type { DiaryEntry, MoodScreeningDraft, MoodScreeningResult, ScreeningBand, ScreeningChoice, ScreeningQuestionnaire } from "@/lib/api/types";
import { mock } from "../registry";
import { CHECKED, isoAt, uid } from "./dates";
import { couple, isNewborn, olderStage } from "../timeline";

// Private journal and mood screening. Nothing is stored: a reload shows the
// seed again, and the screens keep what you just saved in their own state.
// Emily (mother) has the diary seed; Jake sees only what she shared with him,
// without its agenda topic, like the real endpoint.

const diarySeed = (authorId: string): DiaryEntry[] => [
  {
    id: uid(450),
    authorId,
    writtenAt: isoAt(-1, 22),
    body: "I keep picturing the birth going wrong. I lie awake running through it. I want to say this out loud to someone who is not Jake yet.",
    visibility: "private",
    agendaTopic: "Birth anxiety",
  },
  {
    id: uid(451),
    authorId,
    writtenAt: isoAt(-3, 20),
    body: "Felt the baby kick during the class today. For a minute everything felt calm. Want to remember this one.",
    visibility: "partner",
  },
  {
    id: uid(452),
    authorId,
    writtenAt: isoAt(-6, 21),
    body: "Back pain again and too tired to cook. Jake did dinner without being asked, which helped more than he knows.",
    visibility: "private",
  },
];

const epds = (rows: [string, ScreeningChoice[]][]) =>
  rows.map(([text, choices], i) => ({ number: i + 1, text, choices }));
const four = (labels: string[], values: number[]): ScreeningChoice[] => labels.map((label, i) => ({ label, value: values[i] }));
const up = [0, 1, 2, 3];
const down = [3, 2, 1, 0];

const epdsQuestionnaire: ScreeningQuestionnaire = {
  instrument: "epds",
  title: "Edinburgh Postnatal Depression Scale (EPDS)",
  intro: "Please choose the answer that comes closest to how you have felt in the past 7 days, not just how you feel today.",
  suggested: true,
  source: { title: "Cox, Holden and Sagovsky, Br J Psychiatry 1987 (EPDS)", url: "https://doi.org/10.1192/bjp.150.6.782", checkedAt: CHECKED },
  questions: epds([
    ["I have been able to laugh and see the funny side of things", four(["As much as I always could", "Not quite so much now", "Definitely not so much now", "Not at all"], up)],
    ["I have looked forward with enjoyment to things", four(["As much as I ever did", "Rather less than I used to", "Definitely less than I used to", "Hardly at all"], up)],
    ["I have blamed myself unnecessarily when things went wrong", four(["Yes, most of the time", "Yes, some of the time", "Not very often", "No, never"], down)],
    ["I have been anxious or worried for no good reason", four(["No, not at all", "Hardly ever", "Yes, sometimes", "Yes, very often"], up)],
    ["I have felt scared or panicky for no very good reason", four(["Yes, quite a lot", "Yes, sometimes", "No, not much", "No, not at all"], down)],
    ["Things have been getting on top of me", four(["Yes, most of the time I haven't been able to cope at all", "Yes, sometimes I haven't been coping as well as usual", "No, most of the time I have coped quite well", "No, I have been coping as well as ever"], down)],
    ["I have been so unhappy that I have had difficulty sleeping", four(["Yes, most of the time", "Yes, sometimes", "Not very often", "No, not at all"], down)],
    ["I have felt sad or miserable", four(["Yes, most of the time", "Yes, quite often", "Not very often", "No, not at all"], down)],
    ["I have been so unhappy that I have been crying", four(["Yes, most of the time", "Yes, quite often", "Only occasionally", "No, never"], down)],
    ["The thought of harming myself has occurred to me", four(["Yes, quite often", "Sometimes", "Hardly ever", "Never"], down)],
  ]),
};

const phqChoices = four(["Not at all", "Several days", "More than half the days", "Nearly every day"], up);
const phqQuestionnaire: ScreeningQuestionnaire = {
  instrument: "phq9",
  title: "Patient Health Questionnaire (PHQ-9)",
  intro: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  suggested: false,
  source: { title: "Kroenke, Spitzer and Williams, J Gen Intern Med 2001 (PHQ-9)", url: "https://doi.org/10.1046/j.1525-1497.2001.016009606.x", checkedAt: CHECKED },
  questions: [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself, or that you are a failure or have let yourself or your family down",
    "Trouble concentrating on things, such as reading or watching television",
    "Moving or speaking so slowly that other people could have noticed, or being so fidgety or restless that you have been moving around a lot more than usual",
    "Thoughts that you would be better off dead, or of hurting yourself in some way",
  ].map((text, i) => ({ number: i + 1, text, choices: phqChoices })),
};

const drafts = new Map<string, MoodScreeningDraft>();

const bandMessage: Record<ScreeningBand, string> = {
  green: "Your answers are below the cutoff for this questionnaire. Check in again in a few weeks.",
  amber: "Your answers are close to the cutoff. Take the questionnaire again in two weeks and mention it at your next visit.",
  red: "Your answers are at or above the cutoff. Please talk to your doctor or midwife soon. This is not a diagnosis.",
};

function band(instrument: "epds" | "phq9", score: number): ScreeningBand {
  const [amber, red] = instrument === "epds" ? [10, 13] : [5, 10];
  return score >= red ? "red" : score >= amber ? "amber" : "green";
}

export const wellbeingMocks = {
  ...mock("/members/{memberId}/diary-entries", "get", async (ctx) => {
    const family = await ctx.family();
    // The demo entries are about the pregnancy; the other families, newborn included, start with an empty journal.
    if (olderStage(family) || isNewborn(family)) return { items: [] };
    const { mother } = couple(family);
    if (ctx.path.memberId === mother.id) return { items: diarySeed(mother.id) };
    // The partner sees Emily's shared entry, never her topics.
    return { items: diarySeed(mother.id).filter((e) => e.visibility === "partner").map((e) => ({ ...e, agendaTopic: undefined })) };
  }),
  ...mock("/members/{memberId}/diary-entries", "post", (ctx) => ({
    id: crypto.randomUUID(),
    authorId: ctx.path.memberId,
    writtenAt: new Date().toISOString(),
    body: ctx.body.body,
    visibility: ctx.body.visibility,
    ...(ctx.body.agendaTopic ? { agendaTopic: ctx.body.agendaTopic } : {}),
  })),
  ...mock("/members/{memberId}/diary-entries/{entryId}", "patch", (ctx) => {
    const seed = diarySeed(ctx.path.memberId).find((e) => e.id === ctx.path.entryId);
    return {
      id: ctx.path.entryId,
      authorId: ctx.path.memberId,
      writtenAt: seed?.writtenAt ?? new Date().toISOString(),
      body: seed?.body ?? "",
      visibility: ctx.body.visibility,
      ...(ctx.body.agendaTopic ? { agendaTopic: ctx.body.agendaTopic } : {}),
    };
  }),

  ...mock("/members/{memberId}/screening-questionnaires", "get", () => ({ items: [epdsQuestionnaire, phqQuestionnaire] })),
  ...mock("/members/{memberId}/mood-screenings", "get", (ctx): { items: MoodScreeningResult[] } => ({
    items: [
      {
        id: uid(460),
        authorId: ctx.path.memberId,
        instrument: "epds",
        takenAt: isoAt(-21, 15),
        score: 8,
        maxScore: 30,
        band: "green",
        urgent: false,
        message: bandMessage.green,
        source: epdsQuestionnaire.source,
        visibility: "private",
      },
    ],
  })),
  ...mock("/members/{memberId}/mood-screenings", "post", (ctx): MoodScreeningResult => {
    const q = ctx.body.instrument === "epds" ? epdsQuestionnaire : phqQuestionnaire;
    const score = ctx.body.answers.reduce((a, b) => a + b, 0);
    const last = ctx.body.answers[ctx.body.answers.length - 1];
    // The self-harm item is the last one of both instruments: EPDS 10 scores 0 for "Never", PHQ-9 item 9 for "Not at all".
    const urgent = last > 0;
    const b = band(ctx.body.instrument, score);
    return {
      id: crypto.randomUUID(),
      authorId: ctx.path.memberId,
      instrument: ctx.body.instrument,
      takenAt: new Date().toISOString(),
      score,
      maxScore: q.questions.length * 3,
      band: b,
      urgent,
      message: bandMessage[b],
      source: q.source,
      visibility: ctx.body.visibility,
    };
  }),

  // Drafts and sharing answer 501 until the backend exists. A draft lives in
  // this module only, so it survives leaving the questionnaire but not a reload.
  ...mock("/members/{memberId}/mood-screening-drafts", "get", () => ({ items: [...drafts.values()] })),
  ...mock("/members/{memberId}/mood-screening-drafts/{instrument}", "put", (ctx) => {
    const draft = { instrument: ctx.path.instrument as "epds" | "phq9", answers: ctx.body.answers, updatedAt: new Date().toISOString() };
    drafts.set(draft.instrument, draft);
    return draft;
  }),
  ...mock(
    "/members/{memberId}/mood-screening-drafts/{instrument}",
    "delete",
    (ctx) => {
      drafts.delete(ctx.path.instrument);
      return undefined as never;
    },
    204,
  ),
  ...mock("/members/{memberId}/mood-screenings/{screeningId}", "patch", (ctx): MoodScreeningResult => ({
    id: ctx.path.screeningId,
    authorId: ctx.path.memberId,
    instrument: "epds",
    takenAt: new Date().toISOString(),
    score: 12,
    maxScore: 30,
    band: "amber",
    urgent: false,
    message: bandMessage.amber,
    source: epdsQuestionnaire.source,
    visibility: ctx.body.visibility,
  })),
};
