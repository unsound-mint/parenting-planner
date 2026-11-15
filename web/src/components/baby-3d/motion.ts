import { STILL, type Area, type Motion, type Params } from "./model";

// Life in the 3D baby: short movements on top of the week's pose. Idle ones
// follow what the baby can do at that stage (the embryo's heartbeat, kicks from
// about 16 weeks, blinks once the eyes open); tapping a hotspot plays the
// movement that belongs to it. Everything here is plain math on time; the
// scene samples it once per frame and skips it all under reduced motion.

export type Act = keyof Motion | "hiccup" | "breathe" | "glow";
export type Beat = { act: Act; at: number };

/** What tapping each hotspot does. Areas with no visible movement only get the camera turn. */
export const TAP: Partial<Record<Area, Act>> = {
  hands: "grip",
  legs: "kick",
  movement: "kick",
  eyes: "blink",
  mouth: "yawn",
  face: "yawn",
  ears: "nod",
  brain: "nod",
  heart: "glow",
  lungs: "breathe",
  tummy: "hiccup",
  body: "stretch",
  bones: "stretch",
};

const DURATION: Record<Act, number> = {
  kick: 0.9,
  stretch: 2.2,
  blink: 0.3,
  yawn: 2.4,
  grip: 1.6,
  beat: 0,
  nod: 1.8,
  hiccup: 2.4,
  breathe: 4.5,
  glow: 2.6,
};

const ease = (t: number) => t * t * (3 - 2 * t);
/** Up and back down once over u in [0, 1]. */
const hump = (u: number) => Math.sin(Math.PI * u);

/** The shape of one movement over its own time u in [0, 1]. */
function shape(act: Act, u: number): number {
  switch (act) {
    case "kick":
      // Out fast, back slow.
      return u < 0.25 ? ease(u / 0.25) : 1 - ease((u - 0.25) / 0.75);
    case "grip":
      // Two squeezes.
      return Math.sin(2 * Math.PI * u) ** 2;
    case "breathe":
      // Three slow breaths.
      return (1 - Math.cos(6 * Math.PI * u)) / 2;
    case "hiccup": {
      // Three quick jolts that settle.
      const k = (u * 3) % 1;
      return Math.exp(-k * 9) * Math.sin(Math.min(1, k * 9) * Math.PI);
    }
    case "glow":
      // A few heartbeats inside a soft swell.
      return hump(u) * (0.55 + 0.45 * Math.max(0, Math.sin(2 * Math.PI * 2.3 * u * DURATION.glow)) ** 4);
    default:
      return ease(hump(u));
  }
}

export type Sample = {
  m: Motion;
  /** Upward jolt of the whole body (hiccups), 0 to 1. */
  jolt: number;
  /** Chest swell (practice breathing), 0 to 1. */
  breath: number;
  /** The heart glow after tapping the heart, 0 to 1. */
  glow: number;
};

/** Everything moving at time now. Ended beats are dropped from the list in place. */
export function sample(beats: Beat[], now: number, p: Params): Sample {
  const m = { ...STILL };
  const out: Sample = { m, jolt: 0, breath: 0, glow: 0 };
  for (let i = beats.length - 1; i >= 0; i--) {
    const b = beats[i];
    const u = (now - b.at) / DURATION[b.act];
    if (u >= 1) {
      beats.splice(i, 1);
      continue;
    }
    if (u < 0) continue;
    const s = shape(b.act, u);
    if (b.act === "hiccup") out.jolt = Math.max(out.jolt, s);
    else if (b.act === "breathe") out.breath = Math.max(out.breath, s);
    else if (b.act === "glow") out.glow = Math.max(out.glow, s);
    else m[b.act] = Math.max(m[b.act], s);
  }
  // The embryo's heart, about 150 beats a minute, only while the bulge shows.
  if (p.heart > 0.05) m.beat = Math.max(m.beat, Math.max(0, Math.sin(2 * Math.PI * 2.5 * now)) ** 6);
  return out;
}

/** Idle movements the baby can make at this stage, and how often (seconds between, min and max). */
function idleActs(p: Params): [Act, number, number][] {
  const acts: [Act, number, number][] = [];
  if (p.eyeOpen > 0.5) acts.push(["blink", 2.5, 6]);
  if (p.legLen > 0.28) acts.push(["kick", 5, 10]);
  if (p.digits > 0.9 && p.legLen > 0.28) acts.push(["grip", 9, 15]);
  if (p.hair > 0.1) acts.push(["yawn", 14, 24]);
  if (p.hair > 0.3) acts.push(["hiccup", 28, 45]);
  if (p.legLen > 0.35) acts.push(["stretch", 18, 30]);
  return acts;
}

/** Adds any idle movement that is due and books the next one. */
export function scheduleIdle(beats: Beat[], next: Partial<Record<Act, number>>, p: Params, now: number) {
  for (const [act, lo, hi] of idleActs(p)) {
    const due = next[act];
    if (due == null) {
      // First sight of this stage: stagger, so they do not all start together.
      next[act] = now + lo * (0.3 + Math.random() * 0.7);
    } else if (now >= due) {
      if (!beats.some((b) => b.act === act)) beats.push({ act, at: now });
      next[act] = now + lo + Math.random() * (hi - lo);
    }
  }
}
