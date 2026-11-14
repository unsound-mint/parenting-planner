import type { SizeShape } from "./sizes";

type Entry = { match: RegExp; shape: SizeShape; variant?: string };

/* First match wins. Patterns run on the lower-cased name with a leading
   article removed, so "a zucchini", "An apple" and "zucchini" all resolve. */
export const SIZE_TABLE: Entry[] = [
  { match: /poppy/, shape: "seed", variant: "poppy" },
  { match: /sesame/, shape: "seed", variant: "sesame" },
  { match: /\bpea\b/, shape: "pea" },
  { match: /grape\b/, shape: "grape" },
  { match: /raspberry/, shape: "raspberry" },
  { match: /strawberry/, shape: "strawberry" },
  { match: /apricot/, shape: "stonefruit", variant: "apricot" },
  { match: /peach/, shape: "stonefruit", variant: "peach" },
  { match: /plum/, shape: "stonefruit", variant: "plum" },
  { match: /\bfig\b/, shape: "fig" },
  { match: /kiwi/, shape: "kiwi" },
  { match: /pineapple/, shape: "pineapple" },
  { match: /pomegranate/, shape: "apple", variant: "pomegranate" },
  { match: /apple/, shape: "apple" },
  { match: /avocado/, shape: "avocado" },
  { match: /pepper/, shape: "pepper" },
  { match: /tomato/, shape: "tomato" },
  { match: /banana/, shape: "banana" },
  { match: /sweet potato/, shape: "tuber" },
  { match: /carrot/, shape: "carrot" },
  { match: /mango/, shape: "mango" },
  { match: /corn/, shape: "corn" },
  { match: /zucchini|courgette/, shape: "zucchini", variant: "zucchini" },
  { match: /cucumber/, shape: "zucchini", variant: "cucumber" },
  { match: /cauliflower/, shape: "cauliflower" },
  { match: /eggplant|aubergine/, shape: "eggplant" },
  { match: /squash/, shape: "squash" },
  { match: /cabbage/, shape: "cabbage" },
  { match: /coconut/, shape: "coconut" },
  { match: /cantaloupe|rockmelon/, shape: "melon", variant: "cantaloupe" },
  { match: /honeydew/, shape: "melon", variant: "honeydew" },
  { match: /watermelon/, shape: "watermelon" },
  { match: /pumpkin/, shape: "pumpkin" },
  { match: /celery/, shape: "stalks", variant: "celery" },
  { match: /rhubarb/, shape: "stalks", variant: "rhubarb" },
  { match: /leek/, shape: "leek" },
  { match: /romaine|lettuce/, shape: "romaine" },
];

/** Unknown names get a round peach: a friendly size, never a blank space. */
export const FALLBACK: { shape: SizeShape; variant: string } = { shape: "stonefruit", variant: "peach" };

export function resolveSize(comparison: string): { shape: SizeShape; variant?: string } {
  const name = comparison
    .toLowerCase()
    .trim()
    .replace(/^(about the size of|the size of)\s+/, "")
    .replace(/^(a|an|the)\s+/, "");
  return SIZE_TABLE.find((e) => e.match.test(name)) ?? FALLBACK;
}
