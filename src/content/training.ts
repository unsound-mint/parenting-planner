// Training scenarios are static content shipped with the app; only progress is
// stored in the database. Product owns the wording (docs/product.md).

export type TrainingOption = {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
};

export type TrainingStep = {
  id: string;
  situation: string;
  options: TrainingOption[];
};

export type Lesson = {
  id: string;
  title: string;
  forRole: "mom" | "partner" | "both";
  minutes: number;
  summary: string;
  steps: TrainingStep[];
  // Completing the lesson offers to put this shift into the family plan.
  offersShift?: { title: string; startMinute: number; endMinute: number };
};

export const LESSONS: Lesson[] = [
  {
    id: "first-night-home",
    title: "First night at home",
    forRole: "partner",
    minutes: 4,
    summary:
      "Rehearse the evening shift so mom can sleep: feeding cues, a diaper change, and passing the baby back with the right information.",
    steps: [
      {
        id: "cue",
        situation:
          "It is 9:40 pm. The baby is turning their head and sucking on their fist. Mom fed them at 8:15 pm and is asleep.",
        options: [
          {
            id: "wait-cry",
            label: "Wait until the baby cries so you are sure they are hungry",
            correct: false,
            feedback:
              "Crying is a late hunger cue. Feeding is easier when you respond to early cues like rooting and hand sucking.",
          },
          {
            id: "check-log",
            label: "Check when the last feeding was, then prepare a feed",
            correct: true,
            feedback:
              "Right. About 90 minutes since the last feed plus early cues means it is time. Knowing the last feeding time is why handoff notes matter.",
          },
          {
            id: "wake-mom",
            label: "Wake mom up and hand the baby over",
            correct: false,
            feedback:
              "If you agreed on pumped milk or formula for this shift, you can handle it. Protecting mom's sleep is the point of the shift.",
          },
        ],
      },
      {
        id: "diaper",
        situation: "After the feed the baby is fussy and the diaper is wet.",
        options: [
          {
            id: "change-first",
            label: "Change the diaper, keeping one hand on the baby on the changing table",
            correct: true,
            feedback: "Yes. Never step away from a baby on a raised surface, even for a second.",
          },
          {
            id: "leave-it",
            label: "Leave it until morning so you do not wake the baby fully",
            correct: false,
            feedback: "A wet diaper is a common reason for fussing. A quick change in dim light usually settles them.",
          },
        ],
      },
      {
        id: "sleep",
        situation: "The baby falls asleep on your chest on the couch. You are exhausted.",
        options: [
          {
            id: "stay-couch",
            label: "Stay on the couch, it is only for a few minutes",
            correct: false,
            feedback:
              "Falling asleep with a baby on a couch is one of the riskiest sleep situations. Move them to their own crib.",
          },
          {
            id: "crib-back",
            label: "Put the baby on their back in their own crib, nothing else in it",
            correct: true,
            feedback: "Correct. Back to sleep, firm flat surface, empty crib.",
          },
        ],
      },
      {
        id: "handoff",
        situation: "Your shift ends at 2 am and mom takes over. What do you pass on?",
        options: [
          {
            id: "nothing",
            label: "Nothing, she will figure it out",
            correct: false,
            feedback: "Without the last feeding time she has to guess when the next feed is due.",
          },
          {
            id: "log-and-note",
            label: "Log the feeding and diaper, then hand off with a short note",
            correct: true,
            feedback:
              "Exactly what the app does: she opens her screen and sees the last feeding, what is done, and what is next.",
          },
        ],
      },
    ],
    offersShift: { title: "Evening shift", startMinute: 21 * 60, endMinute: 26 * 60 },
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
