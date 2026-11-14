import { mock } from "../registry";
import type { ShiftSuggestion, SimulatorAnswerResult, SimulatorQuestion, SimulatorRound, SimulatorSkill, SkillScore } from "@/lib/api/types";

// Preview data for the simulator. Rounds are rebuilt from their id, so a reload
// starts the round again; answers given in this tab are remembered until then.
type Q = { id: string; skill: SimulatorSkill; prompt: string; choices: [string, string][]; right: string; why: string; source: [string, string] };

const questions: Q[] = [
  {
    id: "feed-cues", skill: "feeding",
    prompt: "Your newborn smacks their lips and turns toward your hand. What do you do?",
    choices: [["a", "Offer a feed now: these are early hunger cues"], ["b", "Wait until they cry so they are really hungry"], ["c", "Give a pacifier and wait one hour"]],
    right: "a",
    why: "Rooting and lip smacking are early hunger cues. Feeding at these cues is easier than feeding a crying baby.",
    source: ["AAP: Is my baby hungry or full?", "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Is-My-Baby-Hungry-or-Full.aspx"],
  },
  {
    id: "safe-surface", skill: "safe_sleep",
    prompt: "It is 3 am and you are exhausted. Where should the baby sleep after the feed?",
    choices: [["a", "With you on the sofa, so you can both rest"], ["b", "Alone on their back in the crib or bassinet"], ["c", "On their tummy so they sleep longer"]],
    right: "b",
    why: "Back to sleep, alone, on a firm flat surface lowers the risk of sudden infant death. Sofas are especially risky.",
    source: ["AAP: A parent's guide to safe sleep", "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/A-Parents-Guide-to-Safe-Sleep.aspx"],
  },
  {
    id: "fever", skill: "warning_signs",
    prompt: "Your 3-week-old feels warm. The thermometer reads 100.6 F (38.1 C). What now?",
    choices: [["a", "Give a fever reducer and watch overnight"], ["b", "Call the pediatrician or go to urgent care now"], ["c", "Take another reading in the morning"]],
    right: "b",
    why: "A temperature of 100.4 F (38 C) or more in a baby under 3 months needs a medical check right away.",
    source: ["AAP: When to call the pediatrician", "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/When-to-Call-the-Pediatrician.aspx"],
  },
  {
    id: "cry-soothe", skill: "soothing",
    prompt: "The baby has cried for 40 minutes after a full feed and a clean diaper, and your patience is going. What helps most?",
    choices: [["a", "Shake gently until they stop"], ["b", "Lay them safely in the crib, step away for a few minutes and breathe"], ["c", "Keep going, you must not stop"]],
    right: "b",
    why: "It is safe to put the baby down and take a short break. Never shake a baby. Hand over to your partner when you can.",
    source: ["CDC: Abusive head trauma", "https://www.cdc.gov/abusive-head-trauma/about/index.html"],
  },
  {
    id: "split-nights", skill: "teamwork",
    prompt: "You are both tired. How do you split the night?",
    choices: [["a", "Whoever wakes first gets up, every time"], ["b", "Agree fixed blocks so each of you gets one protected stretch of sleep"], ["c", "Mom does nights because she feeds"]],
    right: "b",
    why: "Protected blocks of 4 to 5 hours help both parents recover. A bottle or pumped milk lets the partner cover a block.",
    source: ["NICHD: Safe to Sleep", "https://safetosleep.nichd.nih.gov/"],
  },
];

const scenarios: { id: string; title: string; summary: string; skills: SimulatorSkill[]; qs: string[]; suggestedShift: ShiftSuggestion }[] = [
  {
    id: "first-night-home", title: "The first night home",
    summary: "Feeding cues, a safe place to sleep and when a warm baby needs a doctor.",
    skills: ["feeding", "safe_sleep", "warning_signs"], qs: ["feed-cues", "safe-surface", "fever"],
    suggestedShift: { title: "Night feeds", days: ["mon", "tue", "wed", "thu", "fri"], startTime: "22:00", endTime: "02:00" },
  },
  {
    id: "crying-and-sharing", title: "Crying and sharing the night",
    summary: "Soothing a baby who will not settle, and splitting the night fairly.",
    skills: ["soothing", "teamwork"], qs: ["cry-soothe", "split-nights"],
    suggestedShift: { title: "Early morning shift", days: ["mon", "wed", "fri"], startTime: "05:00", endTime: "08:00" },
  },
];

const skills: SimulatorSkill[] = ["feeding", "soothing", "safe_sleep", "diapering", "warning_signs", "teamwork"];
const given: Record<string, Record<string, SimulatorAnswerResult>> = {};

function scoresFor(extra: SimulatorAnswerResult[] = []): SkillScore[] {
  // A person who played once: warning signs went wrong, the rest went right.
  const base: Record<string, [number, number]> = { feeding: [2, 2], safe_sleep: [1, 1], warning_signs: [1, 2], soothing: [0, 0], diapering: [0, 0], teamwork: [0, 0] };
  return skills.map((skill) => {
    let [correct, answered] = base[skill];
    for (const a of extra.filter((x) => x.skill === skill)) {
      answered += 1;
      if (a.correct) correct += 1;
    }
    const score = answered ? Math.round((100 * correct) / answered) : undefined;
    return { skill, answered, correct, ...(score !== undefined ? { score } : {}), weak: score !== undefined && score < 70 };
  });
}

// Round ids must be uuids or the real API answers 400 instead of 501 and the mock is skipped.
const scenarioRoundId = (i: number) => `00000000-0000-4000-8000-00000000010${i}`;

function round(id: string): SimulatorRound {
  const sc = scenarios.find((_, i) => scenarioRoundId(i) === id);
  const qs = sc ? sc.qs : ["fever", "feed-cues", "safe-surface"];
  const answers = given[id] ?? {};
  const list: SimulatorQuestion[] = qs.map((qid) => {
    const q = questions.find((x) => x.id === qid)!;
    return { id: q.id, skill: q.skill, prompt: q.prompt, choices: q.choices.map(([cid, text]) => ({ id: cid, text })), ...(answers[qid] ? { answer: answers[qid] } : {}) };
  });
  const completed = list.every((q) => q.answer);
  const all = Object.values(answers);
  const scores = scoresFor(all);
  return {
    id,
    mode: sc ? "scenario" : "practice",
    ...(sc ? { scenarioId: sc.id } : {}),
    title: sc ? sc.title : "Practice round",
    questions: list,
    completed,
    ...(completed
      ? {
          result: {
            correct: all.filter((a) => a.correct).length,
            total: list.length,
            skills: scores,
            weakSpots: scores.filter((s) => s.weak).sort((a, b) => a.score! - b.score!).map((s) => s.skill),
            ...(sc ? { suggestedShift: sc.suggestedShift } : {}),
          },
        }
      : {}),
    createdAt: new Date().toISOString(),
  };
}

export const simulatorMocks = {
  ...mock("/members/{memberId}/simulator", "get", (ctx) => {
    const sk = scoresFor();
    return {
      memberId: ctx.path.memberId,
      skills: sk,
      weakSpots: sk.filter((s) => s.weak).map((s) => s.skill),
      scenarios: scenarios.map((s) => ({ id: s.id, title: s.title, summary: s.summary, skills: s.skills, questionCount: s.qs.length, suggestedShift: s.suggestedShift })),
      roundsCompleted: 1,
    };
  }),
  ...mock("/members/{memberId}/simulator-rounds", "post", (ctx) => {
    const at = scenarios.findIndex((s) => s.id === ctx.body.scenarioId);
    const id = ctx.body.mode === "scenario" && at >= 0 ? scenarioRoundId(at) : crypto.randomUUID();
    delete given[id];
    return round(id);
  }),
  ...mock("/members/{memberId}/simulator-rounds/{roundId}", "get", (ctx) => round(ctx.path.roundId)),
  ...mock("/members/{memberId}/simulator-rounds/{roundId}/answers", "post", (ctx) => {
    const q = questions.find((x) => x.id === ctx.body.questionId)!;
    const id = ctx.path.roundId;
    const result: SimulatorAnswerResult = {
      questionId: q.id,
      choiceId: ctx.body.choiceId,
      correct: ctx.body.choiceId === q.right,
      correctChoiceId: q.right,
      explanation: q.why,
      skill: q.skill,
      source: { title: q.source[0], url: q.source[1], checkedAt: "2026-11-10" },
    };
    given[id] = { ...(given[id] ?? {}), [q.id]: result };
    return { ...result, roundCompleted: round(id).completed };
  }),
};
