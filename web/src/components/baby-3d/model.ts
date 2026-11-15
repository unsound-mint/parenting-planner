import type { GrowthHotspot } from "@/lib/api/types";

// The 3D baby is built only from scaled unit spheres (ellipsoids) and a few
// arcs for the face, so a week change only moves transforms and never rebuilds
// geometry. Everything here is plain math: params(week) blends keyframes,
// layout(params) places every part and every hotspot anchor from the same
// numbers, so the dots follow the body as it morphs.
//
// Model space: the baby curls in the x-y plane with its back on the -x side and
// its front facing the inside of the C; +z is the side that faces the camera.

export type Area = GrowthHotspot["area"];
export type Vec3 = [number, number, number];

/** Body proportions, blended between whole-body keyframes (KEYS). */
type Shape = {
  headR: number;
  /** Spine circle radius and the angles (degrees) of the neck and the bottom. */
  spineR: number;
  neckDeg: number;
  bottomDeg: number;
  /** Where the tail ends (degrees). Equal to bottomDeg once it is gone. */
  tailDeg: number;
  chestR: number;
  bellyR: number;
  bottomR: number;
  armLen: number;
  legLen: number;
  limbR: number;
  /** 0 before the ears show, 1 once they are formed. */
  ears: number;
};

/** Stage features, each 0 to 1 and each on its own week track (TRACKS). */
type Features = {
  /** Embryo red (0) to opaque peach (1). */
  skin: number;
  /** Somite bumps along the back of the early embryo. */
  somites: number;
  /** The early heart bulge under the chest. */
  heart: number;
  /** The yolk sac on its stalk in front of the belly. */
  yolk: number;
  /** Dark eye spots on the sides of the head, before the lids form. */
  eyeSpot: number;
  /** How far the eyes still sit on the sides (1) rather than the front (0). */
  eyeSide: number;
  /** Fused, closed eyelids. */
  lids: number;
  /** Open eyes with a catchlight. */
  eyeOpen: number;
  /** Nose and mouth. */
  face: number;
  /** Ears low on the neck (0) to their place on the head (1). */
  earLift: number;
  /** Hand paddles (0.4) to separate fingers and toes (1). */
  digits: number;
  /** The near hand drifts up to the mouth. */
  thumb: number;
  /** Eyebrows and head hair. */
  hair: number;
  /** Baby fat: round cheeks and blush. */
  fat: number;
  /** Fine body hair (lanugo): a soft fuzz on the skin. */
  lanugo: number;
  /** Vernix: the creamy coating that gives the skin a paler, satin look. */
  vernix: number;
  /** Thin, wrinkly skin before the fat fills it out. */
  wrinkle: number;
  /** The umbilical cord. */
  cord: number;
  /** Turning head down late in pregnancy, 0 head up to 1 head down. */
  turn: number;
};

export type Params = Shape & Features;

type Key = [week: number, p: Shape];

// Tuned by eye against the NHS descriptions: a curled embryo with a tail at 4
// to 8, limb buds at 6, a big head around 12, then longer limbs and a fuller
// body. The head stays generous at every week: it is a toy, not an atlas.
const KEYS: Key[] = [
  [4, { headR: 0.2, spineR: 0.3, neckDeg: 96, bottomDeg: 236, tailDeg: 330, chestR: 0.13, bellyR: 0.14, bottomR: 0.11, armLen: 0, legLen: 0, limbR: 0, ears: 0 }],
  [6, { headR: 0.24, spineR: 0.29, neckDeg: 98, bottomDeg: 238, tailDeg: 312, chestR: 0.15, bellyR: 0.15, bottomR: 0.12, armLen: 0.05, legLen: 0.03, limbR: 0.04, ears: 0 }],
  [8, { headR: 0.29, spineR: 0.28, neckDeg: 100, bottomDeg: 240, tailDeg: 278, chestR: 0.16, bellyR: 0.16, bottomR: 0.13, armLen: 0.14, legLen: 0.09, limbR: 0.05, ears: 0 }],
  [10, { headR: 0.33, spineR: 0.28, neckDeg: 102, bottomDeg: 242, tailDeg: 244, chestR: 0.17, bellyR: 0.18, bottomR: 0.14, armLen: 0.2, legLen: 0.17, limbR: 0.055, ears: 0.6 }],
  [12, { headR: 0.34, spineR: 0.28, neckDeg: 104, bottomDeg: 244, tailDeg: 244, chestR: 0.17, bellyR: 0.19, bottomR: 0.15, armLen: 0.24, legLen: 0.22, limbR: 0.06, ears: 1 }],
  [16, { headR: 0.32, spineR: 0.29, neckDeg: 104, bottomDeg: 246, tailDeg: 246, chestR: 0.18, bellyR: 0.2, bottomR: 0.16, armLen: 0.3, legLen: 0.3, limbR: 0.062, ears: 1 }],
  [20, { headR: 0.3, spineR: 0.28, neckDeg: 106, bottomDeg: 242, tailDeg: 242, chestR: 0.19, bellyR: 0.21, bottomR: 0.18, armLen: 0.32, legLen: 0.36, limbR: 0.068, ears: 1 }],
  [26, { headR: 0.29, spineR: 0.27, neckDeg: 108, bottomDeg: 238, tailDeg: 238, chestR: 0.205, bellyR: 0.23, bottomR: 0.2, armLen: 0.34, legLen: 0.4, limbR: 0.078, ears: 1 }],
  [32, { headR: 0.285, spineR: 0.26, neckDeg: 108, bottomDeg: 234, tailDeg: 234, chestR: 0.225, bellyR: 0.255, bottomR: 0.22, armLen: 0.35, legLen: 0.42, limbR: 0.08, ears: 1 }],
  [40, { headR: 0.285, spineR: 0.255, neckDeg: 108, bottomDeg: 232, tailDeg: 232, chestR: 0.24, bellyR: 0.275, bottomR: 0.235, armLen: 0.36, legLen: 0.44, limbR: 0.085, ears: 1 }],
];


// What changes besides size, each on its own [week, value] track so a feature
// can turn on at its own week. Timings follow the NHS week-by-week pages and
// common embryology timelines: somites and the heart bulge in weeks 4 to 6,
// eye pigment around 6, paddles then fingers 8 to 10, lids fused around 10 and
// open again about 26 to 28, eyebrows and hair from about 22, fat in the third
// trimester. Rounded to what reads on a toy, not exact to the day.
const TRACKS: Record<keyof Features, [week: number, v: number][]> = {
  skin: [[4, 0], [10, 0.15], [20, 0.45], [28, 0.7], [36, 1]],
  somites: [[4, 1], [6, 0.8], [8, 0.25], [9.5, 0]],
  heart: [[4, 1], [7, 0.9], [9, 0.35], [11, 0]],
  yolk: [[4, 1], [8, 0.8], [10, 0.3], [11.5, 0]],
  eyeSpot: [[5, 0], [6, 0.8], [8, 1], [9.5, 0]],
  eyeSide: [[4, 1], [7, 0.85], [10, 0.4], [14, 0]],
  lids: [[8, 0], [10, 1], [26, 1], [28, 0]],
  eyeOpen: [[26, 0], [28, 1]],
  face: [[7, 0], [10, 0.7], [13, 1]],
  earLift: [[9, 0], [13, 0.6], [20, 1]],
  digits: [[6, 0], [8, 0.4], [10, 1]],
  thumb: [[12, 0], [16, 0.8], [24, 1], [32, 0.35], [40, 0.15]],
  hair: [[20, 0], [24, 0.45], [32, 0.8], [40, 1]],
  fat: [[22, 0], [28, 0.3], [34, 0.75], [40, 1]],
  lanugo: [[20, 0], [23, 1], [32, 0.7], [38, 0.1]],
  vernix: [[18, 0], [21, 1], [36, 0.7], [40, 0.4]],
  wrinkle: [[20, 0], [23, 0.9], [28, 0.6], [34, 0.1], [38, 0]],
  cord: [[6, 0], [9, 1]],
  turn: [[30, 0], [36, 1]],
};

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function track(keys: [number, number][], w: number): number {
  if (w <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [w1, b] = keys[i];
    if (w <= w1) {
      const [w0, a] = keys[i - 1];
      return a + (b - a) * smooth((w - w0) / (w1 - w0));
    }
  }
  return keys[keys.length - 1][1];
}

/** Keyframe blend for any week, fractional weeks included (the morph passes through them). */
export function params(week: number): Params {
  const w = Math.min(40, Math.max(4, week));
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= w) i++;
  const [w0, a] = KEYS[i];
  const [w1, b] = KEYS[i + 1];
  const shape = mix(a, b, smooth(clamp01((w - w0) / (w1 - w0))));
  const features = {} as Features;
  for (const k of Object.keys(TRACKS) as (keyof Features)[]) features[k] = track(TRACKS[k], w);
  return { ...shape, ...features };
}


export function mix<T extends Record<keyof T, number>>(a: T, b: T, t: number): T {
  const out = {} as T;
  for (const k of Object.keys(a) as (keyof T)[]) out[k] = (a[k] + (b[k] - a[k]) * t) as T[keyof T];
  return out;
}

export type Tone = "skin" | "ink" | "blush" | "shine" | "hair" | "yolk";

/** One ellipsoid (or a face arc when arc is set): center, radii, and its local axes. */
export type Part = {
  pos: Vec3;
  radii: Vec3;
  /** Unit vectors for the part's local x, y and z. */
  basis: [Vec3, Vec3, Vec3];
  tone: Tone;
  /** Face lines: a half torus whose ring radius is radii[0] and tube radius radii[1]. */
  arc?: "lid" | "smile";
};

export type Layout = {
  /** TUBE_RINGS rings from the neck cap to the tail cap. */
  tube: Ring[];
  /** CORD_RINGS rings from the belly, round behind the baby. */
  cord: Ring[];
  parts: Part[];
  anchors: Record<Area, { pos: Vec3; normal: Vec3 }>;
  /** Where each newly formed feature sits, for the sparkle when a week adds it. */
  marks: Record<Mark, Vec3>;
};

export type Mark = "eyes" | "nose" | "hands" | "feet" | "ears" | "crown" | "cheeks" | "cord";

/** Which mark lights up when a feature grows into a new week. */
export const FEATURE_MARK: Partial<Record<keyof Params, Mark[]>> = {
  eyeSpot: ["eyes"],
  lids: ["eyes"],
  eyeOpen: ["eyes"],
  face: ["nose"],
  digits: ["hands", "feet"],
  ears: ["ears"],
  earLift: ["ears"],
  hair: ["crown"],
  fat: ["cheeks"],
  cord: ["cord"],
};

// Fixed counts so the scene can keep one mesh per slot across weeks.
// Enough rings that the embryo's somite bumps read as bumps, not aliasing.
export const BODY_RINGS = 72;
export const TAIL_RINGS = 14;
export const CAP_RINGS = 7;
export const TUBE_RINGS = BODY_RINGS + TAIL_RINGS + 2 * CAP_RINGS;
/** Points around each ring of the body tube. */
export const TUBE_SIDES = 36;

/** One cross-section of the body tube: center, radius, and the in-plane direction to the back. */
export type Ring = {
  c: Vec3;
  r: number;
  /** The cross-section spans out and side (Z for the body, which curls in the x-y plane). */
  out: Vec3;
  side?: Vec3;
  /** Extra radius on the back side only (somites). */
  bump: number;
};

export const CORD_RINGS = 56;
export const CORD_SIDES = 12;

const v = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
};
const lin = (...ws: [number, Vec3][]): Vec3 => ws.reduce<Vec3>((acc, [w, d]) => v.add(acc, v.mul(d, w)), [0, 0, 0]);
const rad = (d: number) => (d * Math.PI) / 180;
const Z: Vec3 = [0, 0, 1];

/** An orthonormal basis whose y axis is dir. */
function alongY(dir: Vec3): [Vec3, Vec3, Vec3] {
  const y = v.norm(dir);
  const ref: Vec3 = Math.abs(y[2]) > 0.9 ? [1, 0, 0] : Z;
  const x = v.norm(v.cross(y, ref));
  return [x, y, v.cross(x, y)];
}

/** An orthonormal basis whose z axis is out (the face arcs face outward) and whose y leans to up. */
function facing(out: Vec3, up: Vec3): [Vec3, Vec3, Vec3] {
  const z = v.norm(out);
  const x = v.norm(v.cross(up, z));
  return [x, v.cross(z, x), z];
}

const sphere = (pos: Vec3, r: number, tone: Tone = "skin"): Part => ({ pos, radii: [r, r, r], basis: [[1, 0, 0], [0, 1, 0], Z], tone });

/** p, pulled back toward from so it is at most len away (a limb cannot reach further). */
function reach(from: Vec3, p: Vec3, len: number): Vec3 {
  const d = v.sub(p, from);
  const l = v.len(d);
  const max = len * 0.97;
  return l > max ? v.add(from, v.mul(d, max / l)) : p;
}

/** The middle joint of a two-part limb of total length len from a to b, bent toward pole. */
function joint(a: Vec3, b: Vec3, len: number, pole: Vec3): Vec3 {
  const d = v.sub(b, a);
  const dist = v.len(d);
  const mid = v.add(a, v.mul(d, 0.5));
  const h = Math.sqrt(Math.max(0, (len / 2) ** 2 - (dist / 2) ** 2));
  const dn = v.norm(d);
  const off = v.norm(v.sub(pole, v.mul(dn, v.dot(pole, dn))));
  return v.add(mid, v.mul(off, h));
}

/** A soft limb segment from a to b: an ellipsoid that overlaps both joints. */
function segment(a: Vec3, b: Vec3, r: number): Part {
  const d = v.sub(b, a);
  const half = v.len(d) / 2;
  return { pos: v.add(a, v.mul(d, 0.5)), radii: [r, half + r * 0.6, r], basis: alongY(d), tone: "skin" };
}

/**
 * Short-lived motion on top of the week's pose, each 0 to 1 except nod (-1 to 1).
 * The scene animates these; layout only bends parts with them, so motion never
 * touches the body tube and costs no geometry rebuild.
 */
export type Motion = {
  /** The near leg straightens. */
  kick: number;
  /** Arms and legs reach out. */
  stretch: number;
  /** Open eyes close for a moment. */
  blink: number;
  /** The mouth opens. */
  yawn: number;
  /** Fingers curl into a fist. */
  grip: number;
  /** The heart bulge throbs. */
  beat: number;
  /** The head turns a little toward the near (1) or far (-1) side. */
  nod: number;
};

export const STILL: Motion = { kick: 0, stretch: 0, blink: 0, yawn: 0, grip: 0, beat: 0, nod: 0 };

export function layout(p: Params, m: Motion = STILL): Layout {
  const parts: Part[] = [];
  const spine = (deg: number, r = p.spineR): Vec3 => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg)), 0];
  // At angle deg: out = the back (away from the C's center), front = into the C, down = along the spine toward the bottom.
  const outAt = (deg: number): Vec3 => [Math.cos(rad(deg)), Math.sin(rad(deg)), 0];
  const downAt = (deg: number): Vec3 => [-Math.sin(rad(deg)), Math.cos(rad(deg)), 0];
  const span = p.bottomDeg - p.neckDeg;
  const torsoAt = (s: number) => {
    const deg = p.neckDeg + span * s;
    // Chest to belly to bottom: a soft bean, widest a little below the middle.
    const r = s < 0.6 ? p.chestR + (p.bellyR - p.chestR) * smooth(s / 0.6) : p.bellyR + (p.bottomR - p.bellyR) * smooth((s - 0.6) / 0.4);
    return { c: spine(deg), r, out: outAt(deg), front: v.mul(outAt(deg), -1), down: downAt(deg) };
  };

  // Body and tail: one smooth lofted tube along the spine, closed with round caps.
  const tailSpan = Math.max(0, p.tailDeg - p.bottomDeg);
  const taper = Math.min(1, tailSpan / 30);
  const rings: Ring[] = [];
  for (let i = 0; i < BODY_RINGS; i++) {
    const t = torsoAt(i / (BODY_RINGS - 1));
    // Somites: a row of small bumps down the back of the early embryo.
    const bump = p.somites * 0.12 * Math.max(0, Math.sin(i * 1.15)) ** 2;
    rings.push({ c: t.c, r: t.r, out: t.out, bump });
  }
  // The embryo's tail continues past the bottom, spiralling in and thinning; at
  // zero span every tail ring sits on the bottom, so the end stays round.
  const tailAt = (s: number): Vec3 => spine(p.bottomDeg + tailSpan * s, p.spineR * (1 - 0.35 * s * taper));
  for (let i = 1; i <= TAIL_RINGS; i++) {
    const s = i / TAIL_RINGS;
    rings.push({ c: tailAt(s), r: p.bottomR * (1 - 0.82 * s * taper), out: outAt(p.bottomDeg + tailSpan * s), bump: 0 });
  }
  const startT = v.mul(downAt(p.neckDeg), -1);
  const endT = tailSpan > 0.5 ? v.norm(v.sub(tailAt(1), tailAt(0.97))) : downAt(p.bottomDeg);
  const cap = (end: Ring, dir: Vec3): Ring[] =>
    Array.from({ length: CAP_RINGS }, (_, k) => {
      const u = (k + 1) / CAP_RINGS;
      return { c: v.add(end.c, v.mul(dir, end.r * u)), r: end.r * Math.sqrt(Math.max(0, 1 - u * u)), out: end.out, bump: 0 };
    });
  const tube = [...cap(rings[0], startT).reverse(), ...rings, ...cap(rings[rings.length - 1], endT)];

  // Head: on the neck, leaning forward over the chest.
  const neck = torsoAt(0);
  // A nod turns the head toward or away from the camera around the neck.
  const headDir = v.norm(lin([0.75, neck.out], [-0.6, neck.down], [0.3 * m.nod, Z]));
  const head = v.add(neck.c, v.mul(headDir, p.headR * 0.78 + neck.r * 0.25));
  const headUp = headDir;
  const hr = p.headR;
  parts.push({ pos: head, radii: [hr, hr * 0.97, hr], basis: [[1, 0, 0], [0, 1, 0], Z], tone: "skin" });

  // Every part below is pushed at every week, scaled to zero while its feature
  // is off, so the scene keeps one mesh per slot.
  // Face: toward the front of the curl, turned toward the camera so it can be seen.
  const forward = v.norm(lin([1, v.cross(headUp, Z)], [-0.15, headUp]));
  const faceDir = v.norm(lin([0.55, forward], [0.83, Z]));
  const side = v.norm(v.cross(headUp, faceDir));
  const down = v.mul(headUp, -1);
  const onHead = (d: Vec3, lift = 1) => v.add(head, v.mul(v.norm(d), hr * lift));
  // Embryo eyes sit on the sides of the head and move round to the front.
  const eyeDir = (sgn: number) => v.norm(lin([1 - 0.6 * p.eyeSide, faceDir], [(0.36 + 0.75 * p.eyeSide) * sgn, side], [0.1, headUp]));
  const brows = clamp01(p.hair * 2.2);
  const blush = Math.max(p.fat, 0.45 * clamp01((p.skin - 0.35) / 0.3));
  for (const sgn of [-1, 1]) {
    const d = eyeDir(sgn);
    // A blink draws the lids back over open eyes.
    const lid = hr * Math.max(p.lids, m.blink * p.eyeOpen);
    parts.push({ pos: onHead(d, 0.995), radii: [lid * 0.12, lid * 0.025, 0], basis: facing(d, headUp), tone: "ink", arc: "lid" });
    // One dark disc: the eye spot of the embryo, later the open eye.
    const pupil = hr * (0.11 * p.eyeSpot + 0.095 * p.eyeOpen);
    const open = 1 - m.blink * p.eyeOpen;
    parts.push({ pos: onHead(d, 0.975), radii: [pupil * 0.92 * open, pupil * open, pupil * 0.45 * open], basis: facing(d, headUp), tone: "ink" });
    const shine = hr * 0.032 * p.eyeOpen * open;
    parts.push(sphere(onHead(lin([1, d], [0.045, headUp], [0.03 * sgn, side]), 1.01), shine, "shine"));
    const browDir = v.norm(lin([1, d], [0.3, headUp]));
    parts.push({ pos: onHead(browDir, 0.995), radii: [hr * 0.13 * brows, hr * 0.02 * brows, 0], basis: facing(browDir, down), tone: "hair", arc: "lid" });
    // Baby fat: a round cheek under the blush.
    const cheek = v.norm(lin([1, faceDir], [0.55 * sgn, side], [-0.22, headUp]));
    parts.push({ pos: onHead(cheek, 0.83), radii: [hr * 0.26 * p.fat, hr * 0.22 * p.fat, hr * 0.22 * p.fat], basis: facing(cheek, headUp), tone: "skin" });
    parts.push({ pos: onHead(cheek, 0.94 + 0.08 * p.fat), radii: [hr * 0.16 * blush, hr * 0.11 * blush, hr * 0.1 * blush], basis: facing(cheek, headUp), tone: "blush" });
  }
  const mouthDir = v.norm(lin([1, faceDir], [-0.3, headUp]));
  const mouth = hr * p.face;
  const smile = mouth * (1 - m.yawn);
  parts.push({ pos: onHead(mouthDir, 0.995), radii: [smile * 0.07, smile * 0.022, 0], basis: facing(mouthDir, headUp), tone: "ink", arc: "smile" });
  // A yawn: a small round open mouth in place of the smile.
  const gape = mouth * m.yawn;
  parts.push({ pos: onHead(mouthDir, 0.96), radii: [gape * 0.065, gape * 0.08, gape * 0.05], basis: facing(mouthDir, headUp), tone: "ink" });
  const noseDir = v.norm(lin([1, faceDir], [-0.08, headUp]));
  parts.push({ pos: onHead(noseDir, 0.97), radii: [hr * 0.085 * p.face, hr * 0.065 * p.face, hr * 0.075 * p.face], basis: facing(noseDir, headUp), tone: "skin" });

  // Hair: a sphere that always pokes 3% out of the crown; as it grows and sinks
  // in, the patch it leaves on the head spreads from a tuft to a full cap.
  const capR = p.hair > 0.01 ? hr * (0.35 + 0.5 * p.hair) : 0;
  const crown = v.norm(lin([1, headUp], [-0.6, forward], [0.05, Z]));
  parts.push(sphere(v.add(head, v.mul(crown, hr * 1.03 - capR)), capR, "hair"));
  const curlDir = v.norm(lin([1, headUp], [0.3, forward], [0.15, Z]));
  const curl = hr * clamp01((p.hair - 0.2) / 0.5);
  parts.push({ pos: onHead(curlDir, 1.04), radii: [curl * 0.05, curl * 0.12, curl * 0.05], basis: alongY(lin([1, curlDir], [0.6, forward])), tone: "hair" });

  // Ears on both sides, small and round; they start low by the neck and rise.
  const earDir = (sgn: number) => v.norm(lin([sgn, side], [-0.35, faceDir], [-0.08 - 0.55 * (1 - p.earLift), headUp]));
  for (const sgn of [-1, 1]) {
    const d = earDir(sgn);
    const er = hr * 0.2 * p.ears;
    parts.push({ pos: onHead(d, 0.93), radii: [er, er * 1.15, er * 0.55], basis: facing(d, headUp), tone: "skin" });
  }

  // The embryo's heart bulge under the chest, and the yolk sac on its stalk.
  const chest = torsoAt(0.26);
  parts.push(sphere(v.add(chest.c, v.mul(chest.front, chest.r * 0.62)), chest.r * 0.72 * p.heart * (1 + 0.14 * m.beat)));
  const belly = torsoAt(0.62);
  const yr = 0.075 * p.yolk;
  const stalkFrom = v.add(belly.c, v.mul(belly.front, belly.r * 0.8));
  const sac = v.add(belly.c, lin([belly.r + 0.05 + yr, belly.front], [0.07, Z], [0.03, belly.down]));
  parts.push({ ...segment(stalkFrom, sac, 0.016 * p.yolk), tone: "yolk" }, sphere(sac, yr, "yolk"));

  // Limbs are placed by where they end up: hands by the chin, knees forward,
  // feet tucked by the bottom, all on the sides of the body (the curl is nearly
  // a ball, so there is no room inside the C). joint() bends each limb at a
  // fixed length, so kicks, stretches and the thumb only move the end points.
  // Limb buds show from about week 6; early, short limbs just point at their target.
  const limbR = p.limbR > 0.001 ? p.limbR : 0;
  const fingers = clamp01((p.digits - 0.4) / 0.6);
  const paddle = clamp01(p.digits / 0.4);
  const mouthPt = onHead(mouthDir, 1.1);
  const chin = onHead(lin([1, faceDir], [-1.05, headUp]), 1.04);
  const shoulder = torsoAt(0.1);
  const hip = torsoAt(0.84);
  const tuck = torsoAt(0.97);
  // A newborn's hands rest in a loose fist; a stretch opens them.
  const grip = Math.max(m.grip, 0.6 * (1 - m.stretch));
  const limbs: { hand: Vec3; elbow: Vec3; knee: Vec3; foot: Vec3 }[] = [];
  for (const sgn of [1, -1]) {
    const zs: Vec3 = [0, 0, sgn];
    const s0 = v.add(shoulder.c, lin([shoulder.r * 0.8, zs], [shoulder.r * 0.1, shoulder.front]));
    const rest = lin([1, chin], [hr * 0.3 * sgn, side], [hr * 0.35 * sgn, Z]);
    // The near hand drifts to the mouth mid-pregnancy; a stretch reaches out and down.
    const toMouth = sgn === 1 ? 0.85 * p.thumb : 0;
    const reachOut = v.add(s0, v.mul(v.norm(lin([0.7, shoulder.front], [0.5, shoulder.down], [0.6, zs])), p.armLen));
    const handAt = lin([(1 - toMouth) * (1 - m.stretch), rest], [toMouth * (1 - m.stretch), mouthPt], [m.stretch, reachOut]);
    const hand = reach(s0, handAt, p.armLen);
    const elbow = joint(s0, hand, p.armLen, lin([1, shoulder.down], [0.9, zs], [-0.2, shoulder.front]));
    const along = v.norm(v.sub(hand, elbow));
    const hb = alongY(along);
    const hs = limbR * 1.2;
    parts.push(
      segment(s0, elbow, limbR),
      segment(elbow, hand, limbR * 0.9),
      // A round bud, then a flat paddle, then a palm with fingers.
      { pos: hand, radii: [hs * (1 + 0.15 * paddle), hs, hs * (1 - 0.3 * paddle)], basis: hb, tone: "skin" },
    );
    const fr = limbR * fingers;
    for (let j = 0; j < 4; j++) {
      const open = lin([1, hand], [hs * 0.95, along], [(j - 1.5) * limbR * 0.45, hb[0]]);
      // Curled: the fingertips fold back over the palm, so they read as knuckles.
      const curled = lin([1, hand], [hs * 0.55, along], [(j - 1.5) * limbR * 0.4, hb[0]], [hs * 0.45, hb[2]]);
      parts.push({ pos: v.add(open, v.mul(v.sub(curled, open), grip)), radii: [fr * 0.25, fr * 0.42, fr * 0.24], basis: hb, tone: "skin" });
    }
    parts.push({ pos: lin([1, hand], [hs * 0.35, along], [hs * 0.95, hb[0]]), radii: [fr * 0.3, fr * 0.45, fr * 0.3], basis: alongY(lin([0.6, along], [1, hb[0]])), tone: "skin" });

    const lr = limbR * 1.05;
    const h0 = v.add(hip.c, lin([hip.r * 0.75, zs], [hip.r * 0.1, hip.front]));
    const tucked = lin([1, tuck.c], [tuck.r * 0.7, tuck.front], [tuck.r * 1.0, zs]);
    // A kick (near leg) or a stretch (both) pushes the foot away, which straightens the knee.
    const straighten = Math.max(m.stretch, sgn === 1 ? m.kick : 0);
    const kickTo = v.add(h0, v.mul(v.norm(lin([0.55, hip.front], [0.8, hip.down], [0.35, zs])), p.legLen));
    const foot = reach(h0, lin([1 - straighten, tucked], [straighten, kickTo]), p.legLen);
    // Knees bend forward and up toward the chest, and a little outward.
    const knee = joint(h0, foot, p.legLen, lin([1.5, hip.front], [-0.5, hip.down], [0.35, zs]));
    const shin = v.norm(v.sub(foot, knee));
    // The sole faces the bottom; toes point forward, across the shin.
    const toe = v.norm(v.sub(hip.front, v.mul(shin, v.dot(hip.front, shin))));
    const fb = alongY(toe);
    parts.push(segment(h0, knee, lr), segment(knee, foot, lr * 0.82), { pos: v.add(foot, v.mul(toe, lr * 0.35)), radii: [lr * 0.95, lr * 1.5, lr * 0.8], basis: fb, tone: "skin" });
    // Small and set into the tip of the foot, in a row across it.
    const across = v.norm(v.cross(toe, shin));
    const tr = lr * 0.17 * fingers;
    for (let j = 0; j < 5; j++) {
      // Big toe first; the rest step down in size and back along the curve.
      parts.push(sphere(lin([1, foot], [lr * (1.6 - 0.03 * j * j), toe], [(j - 2) * lr * 0.3 * sgn, across], [lr * 0.25, shin]), tr * (j === 0 ? 1.35 : 1 - 0.06 * j)));
    }
    limbs.push({ hand, elbow, knee, foot });
  }

  // Hotspot anchors: on the surface, on the camera side, pushed out a hair so the dot floats.
  const near = limbs[0];
  const surface = (c: Vec3, r: number, d: Vec3) => {
    const n = v.norm(d);
    return { pos: v.add(c, v.mul(n, r * 1.02 + 0.015)), normal: n };
  };
  const torso = (s: number, d: (t: ReturnType<typeof torsoAt>) => Vec3) => {
    const t = torsoAt(s);
    return surface(t.c, t.r, d(t));
  };
  const lr = Math.max(p.limbR, 0.03);
  const anchors: Layout["anchors"] = {
    brain: surface(head, p.headR, lin([1, headUp], [0.35, Z], [-0.2, forward])),
    face: surface(head, p.headR, lin([1, faceDir], [0.25, headUp])),
    // Beside the eye, at the temple, so the dot never sits on the eye itself.
    eyes: surface(head, p.headR, lin([1, eyeDir(1)], [0.42, side], [0.12, headUp])),
    ears: surface(head, p.headR, earDir(-1)),
    mouth: surface(head, p.headR, lin([1, faceDir], [-0.4, headUp], [-0.32, side])),
    heart: torso(0.22, (t) => lin([0.55, t.front], [0.85, Z])),
    lungs: torso(0.08, (t) => lin([0.1, t.out], [1, Z], [-0.2, t.down])),
    tummy: torso(0.58, (t) => lin([0.7, t.front], [0.75, Z])),
    kidneys: torso(0.62, (t) => lin([0.8, t.out], [0.6, Z])),
    skin: torso(0.36, (t) => lin([1, t.out], [0.35, Z])),
    bones: torso(0.5, (t) => lin([1, t.out], [-0.15, Z])),
    body: torso(0.42, (t) => lin([0.2, t.out], [1, Z])),
    cord: torso(0.74, (t) => lin([1, t.front], [0.45, Z])),
    hands: surface(near.hand, lr * 1.3, lin([0.4, Z], [1, v.sub(near.hand, near.elbow)])),
    legs: surface(near.knee, lr * 1.15, lin([1, Z], [0.4, v.sub(near.knee, hip.c)])),
    movement: surface(near.foot, lr * 1.4, lin([1, Z], [0.5, hip.down])),
  };
  // Cord: from the belly, a loose loop in front of the knees and under the
  // bottom, then round behind the baby toward the placenta, out of sight.
  const cordR = 0.024 * p.cord;
  const navel = torsoAt(0.68);
  const low = torsoAt(0.9);
  const path = [
    v.add(navel.c, v.mul(navel.front, navel.r * 0.8)),
    lin([1, navel.c], [navel.r + 0.1, navel.front], [0.17, Z], [0.02, navel.down]),
    lin([1, low.c], [low.r + 0.1, low.front], [0.26, Z], [0.12, low.down]),
    lin([1, low.c], [low.r + 0.1, low.down], [0.14, Z], [0.05, low.out]),
    lin([1, low.c], [low.r * 0.9, low.out], [-0.2, Z], [0.05, low.down]),
    lin([1, torsoAt(0.6).c], [-0.12, Z]),
  ];
  const cord: Ring[] = [];
  for (let i = 0; i < CORD_RINGS; i++) {
    const t = i / (CORD_RINGS - 1);
    const c = catmull(path, t);
    const tangent = v.norm(v.sub(catmull(path, Math.min(1, t + 0.01)), catmull(path, Math.max(0, t - 0.01))));
    const out = v.norm(v.cross(tangent, Math.abs(tangent[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const side = v.cross(tangent, out);
    // The cord's twist: its center winds in a small helix around the path.
    const a = t * 34;
    const twist = lin([Math.cos(a) * cordR * 0.45, out], [Math.sin(a) * cordR * 0.45, side]);
    // Round start; the far end runs into the body, out of sight.
    const end = Math.min(1, i / 2);
    cord.push({ c: v.add(c, twist), r: cordR * Math.sqrt(end), out, side, bump: 0 });
  }

  const cheekMark = onHead(lin([1, faceDir], [0.55, side], [-0.22, headUp]), 1.05);
  const marks: Layout["marks"] = {
    eyes: onHead(eyeDir(1), 1.06),
    nose: onHead(noseDir, 1.08),
    hands: near.hand,
    feet: near.foot,
    ears: onHead(earDir(1), 1.05),
    crown: onHead(crown, 1.06),
    cheeks: cheekMark,
    cord: path[2],
  };
  return { tube, cord, parts, anchors, marks };
}

/** A point along a Catmull-Rom curve through pts, t in [0, 1]. */
function catmull(pts: Vec3[], t: number): Vec3 {
  const n = pts.length - 1;
  const f = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(f);
  const u = f - i;
  const p0 = pts[Math.max(0, i - 1)];
  const [p1, p2] = [pts[i], pts[i + 1]];
  const p3 = pts[Math.min(n, i + 2)];
  const u2 = u * u;
  const u3 = u2 * u;
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)) as Vec3;
}

/** The head-down turn, as an angle around z (radians). */
// Not a full half turn: lying diagonally head down still says "head down" and keeps the face readable.
export const turnAngle = (p: Params) => p.turn * Math.PI * 0.72;

/** p turned by angle around z, the axis the body curls around. */
export function rotZ(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

/**
 * Center and size of the body after the head-down turn by rot, for framing:
 * the model is scaled so its largest extent is 1. The center is in the turned frame.
 */
export function bounds({ parts, tube }: Pick<Layout, "parts" | "tube">, rot = 0): { center: Vec3; size: number } {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  const add = (c: Vec3, r: number) => {
    const q = rotZ(c, rot);
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], q[i] - r);
      hi[i] = Math.max(hi[i], q[i] + r);
    }
  };
  for (const ring of tube) add(ring.c, ring.r);
  for (const p of parts) {
    if (p.tone !== "skin" || p.radii[0] === 0) continue;
    add(p.pos, Math.max(...p.radii));
  }
  return { center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], size: Math.max(hi[0] - lo[0], hi[1] - lo[1]) };
}

/**
 * How big the baby is drawn, 0 to 1 (week 40). NHS measures head to bottom
 * before week 20 and head to heel from then on, so crown-heel lengths are
 * brought back to a head-to-bottom estimate before comparing; otherwise week
 * 20 would look like a growth spurt. A cube root keeps week 4 visible while
 * every week still grows.
 */
export function displayScale(lengthCm: number, measure: string): number {
  const crownRump = measure === "crown-heel" ? lengthCm * 0.62 : lengthCm;
  const full = 51.2 * 0.62;
  return Math.min(1, Math.cbrt(Math.max(crownRump, 0.1) / full));
}
