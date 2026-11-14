import type { ReactNode } from "react";
import { Face } from "./face";

/* The sticker set: one small die-cut illustration per sticker, drawn on a
   120x120 canvas in the flat style of the other illustrations (same palette,
   same face on the baby ones). Each sticker is a white border, a coloured disc
   and a glyph. Path stickers share the frame and differ by glyph; together
   stickers add a second ring and a small heart. Unknown `art` keys (a path
   added later) fall back to a rosette, so a new path never breaks the book.
   Pure SVG: safe in server components. Motion lives in components/missions. */

const INK = "#2B2620";
const WHITE = "#FFFFFF";
const LEAF = "#6E9F52";
const LEAF_D = "#4F7F45";
const SUN = "#F4C85A";
const TERRA = "#D9774F";
const TEAL = "#4E9C97";
const SKY = "#8FB8DE";
const PLUM = "#8A5FB0";
const CREAM = "#FFF3D6";
const SKIN = "#F3B08A";

type Tone = { disc: string; line: string };

const tones = {
  leaf: { disc: "#CFE5BC", line: LEAF_D },
  sun: { disc: "#FBE3A0", line: "#B98414" },
  terra: { disc: "#F6C9B2", line: "#A8502E" },
  teal: { disc: "#BFE0DC", line: "#2F7772" },
  sky: { disc: "#CDE0F1", line: "#4B7BA3" },
  plum: { disc: "#DCC8EA", line: "#6C468F" },
} satisfies Record<string, Tone>;

type ToneName = keyof typeof tones;

const stroke = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 4.5 } as const;

/* Glyphs are drawn around (60, 60), about 56 units across. */

function Book({ t }: { t: Tone }) {
  return (
    <g>
      <path d="M60 44c-8-6-20-7-28-4v34c8-3 20-2 28 4z" fill={WHITE} stroke={t.line} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M60 44c8-6 20-7 28-4v34c-8-3-20-2-28 4z" fill={CREAM} stroke={t.line} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M40 52c5-1 9 0 14 2M40 60c5-1 9 0 14 2M66 54c5-2 9-3 14-2" {...stroke} strokeWidth="2.5" stroke={t.line} opacity=".6" />
    </g>
  );
}

const glyphs: Record<string, (t: Tone) => ReactNode> = {
  "your-pregnancy": () => (
    <g>
      <path d="M44 80h32l-4 14H48z" fill={TERRA} />
      <path d="M60 80V58" stroke={LEAF_D} strokeWidth="4" strokeLinecap="round" />
      <path d="M60 64c-14 0-20-8-20-16 12 0 20 6 20 16z" fill={LEAF} />
      <path d="M60 58c0-12 8-18 20-18 0 10-8 18-20 18z" fill="#8DC46B" />
    </g>
  ),
  birth: () => (
    <g>
      <path d="M32 82c8-18 48-18 56 0z" fill={LEAF} />
      <circle cx="60" cy="68" r="14" fill={SUN} />
      <path d="M60 40v8M40 48l5 6M80 48l-5 6M32 62h8M80 62h8" {...stroke} strokeWidth="3.5" stroke="#E0A52E" />
      <path d="M28 82h64" {...stroke} strokeWidth="3.5" stroke={LEAF_D} />
    </g>
  ),
  feeding: () => (
    <g>
      <rect x="46" y="52" width="24" height="32" rx="9" fill={WHITE} stroke={SKY} strokeWidth="3.5" />
      <rect x="46" y="64" width="24" height="20" rx="8" fill="#E8F0F8" />
      <rect x="51" y="44" width="14" height="10" rx="4" fill={TERRA} />
      <path d="M58 40c0-3 2-5 4-5" {...stroke} strokeWidth="3.5" stroke={TERRA} />
      <path d="M84 50a14 14 0 1 1-8 12 10 10 0 0 0 8-12z" fill={SUN} transform="translate(-4 -8) scale(.8)" />
    </g>
  ),
  "first-weeks": () => (
    <g>
      <path d="M78 36a22 22 0 1 0 10 34 18 18 0 0 1-10-34z" fill={SUN} />
      <path d="M34 72h30M38 82h22M38 72v-8h26v8" stroke={TERRA} {...stroke} strokeWidth="4" />
      <circle cx="88" cy="44" r="3" fill={SUN} />
    </g>
  ),
  couple: () => (
    <g>
      <circle cx="49" cy="60" r="19" fill={TERRA} opacity=".85" />
      <circle cx="71" cy="60" r="19" fill={TEAL} opacity=".85" />
      <path d="M60 46a19 19 0 0 1 0 28 19 19 0 0 1 0-28z" fill={SUN} />
    </g>
  ),
  partner: () => (
    <g>
      <path d="M48 40h22v22l12 10c4 4 2 12-6 14-5 1-9-1-13-4l-15-12c-5-5-4-12 0-15z" fill={TEAL} />
      <path d="M48 40h22v10H48z" fill={WHITE} />
      <path d="M50 46h18" {...stroke} strokeWidth="3" stroke={TEAL} />
    </g>
  ),
  "money-leave": () => (
    <g>
      <rect x="32" y="44" width="56" height="38" rx="6" fill={WHITE} stroke={TERRA} strokeWidth="3.5" />
      <path d="M33 47l27 20 27-20" stroke={TERRA} {...stroke} strokeWidth="3.5" />
      <path d="M60 80s-9-6-9-12a5 5 0 0 1 9-2 5 5 0 0 1 9 2c0 6-9 12-9 12z" fill="#E4586F" transform="translate(0 -2) scale(.9) translate(6 6)" />
    </g>
  ),
  "mental-health": () => (
    <g>
      <circle cx="74" cy="48" r="12" fill={SUN} />
      <path d="M38 80a12 12 0 0 1 4-23 16 16 0 0 1 30 3 11 11 0 0 1 2 20z" fill={WHITE} stroke={SKY} strokeWidth="3.5" strokeLinejoin="round" />
    </g>
  ),
  "eating-before-baby": () => (
    <g>
      <path d="M34 62h52a26 24 0 0 1-52 0z" fill={WHITE} stroke={TERRA} strokeWidth="3.5" />
      <path d="M46 50v10M56 46v14M66 50v10" {...stroke} strokeWidth="3.5" stroke={LEAF_D} />
    </g>
  ),
  "eating-in-pregnancy": () => (
    <g>
      <path d="M34 66h52a26 22 0 0 1-52 0z" fill={LEAF} />
      <path d="M60 66V50" stroke={LEAF_D} strokeWidth="4" strokeLinecap="round" />
      <path d="M60 54c-10 0-16-6-16-12 10 0 16 4 16 12zM60 50c0-9 6-14 16-14 0 8-6 14-16 14z" fill="#8DC46B" />
    </g>
  ),
  "first-foods": () => (
    <g>
      <ellipse cx="50" cy="70" rx="16" ry="12" fill={WHITE} stroke={SKY} strokeWidth="3.5" />
      <ellipse cx="50" cy="68" rx="10" ry="6" fill="#F6C98A" />
      <path d="M68 78l16-34" stroke={TERRA} {...stroke} strokeWidth="5" />
      <ellipse cx="88" cy="38" rx="7" ry="9" fill={TERRA} transform="rotate(25 88 38)" />
    </g>
  ),
  "toddler-plates": () => (
    <g>
      <circle cx="56" cy="62" r="24" fill={WHITE} stroke={TEAL} strokeWidth="3.5" />
      <path d="M56 38v48M32 62h48" stroke={TEAL} strokeWidth="2.5" opacity=".5" />
      <circle cx="46" cy="52" r="6" fill={LEAF} />
      <circle cx="68" cy="52" r="6" fill={TERRA} />
      <circle cx="46" cy="72" r="6" fill={SUN} />
      <rect x="74" y="64" width="14" height="18" rx="4" fill={SKY} />
    </g>
  ),
  rosette: () => (
    <g>
      <path d="M48 70l-8 22 14-6 6 8 6-22M72 70l8 22-14-6-6 8-6-22" fill={TERRA} />
      <circle cx="60" cy="54" r="18" fill={SUN} />
      <circle cx="60" cy="54" r="10" fill={CREAM} />
    </g>
  ),
  mission_first: () => (
    <g>
      <path d="M44 92V36" stroke={INK} {...stroke} strokeWidth="4" />
      <path d="M46 38h38l-9 12 9 12H46z" fill={TERRA} />
      <circle cx="44" cy="92" r="4" fill={INK} />
    </g>
  ),
  mission_both: () => (
    <g>
      <path d="M40 78l-6-22 8-6 12 10 8 4M80 78l6-22-8-6-12 10-8 4" fill={SKIN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" opacity=".001" />
      <circle cx="46" cy="58" r="14" fill={TERRA} />
      <circle cx="74" cy="58" r="14" fill={TEAL} />
      <path d="M60 86s-14-9-14-18a8 8 0 0 1 14-3 8 8 0 0 1 14 3c0 9-14 18-14 18z" fill="#E4586F" stroke={WHITE} strokeWidth="3" />
    </g>
  ),
  mission_meals: () => (
    <g>
      <path d="M36 58h48v12a20 20 0 0 1-20 20H56a20 20 0 0 1-20-20z" fill={TERRA} />
      <rect x="32" y="52" width="56" height="8" rx="4" fill="#B85A35" />
      <path d="M32 62H24M88 62h8" {...stroke} stroke="#B85A35" />
      <path d="M50 44c-4-5 4-8 0-13M62 44c-4-5 4-8 0-13M74 44c-4-5 4-8 0-13" {...stroke} strokeWidth="3" stroke="#B9AFA2" />
    </g>
  ),
  mission_home: () => (
    <g>
      <path d="M36 62l24-22 24 22v26H36z" fill={WHITE} stroke={TEAL} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M30 64l30-28 30 28" stroke={TERRA} {...stroke} strokeWidth="6" />
      <rect x="52" y="68" width="16" height="20" rx="3" fill={SUN} />
    </g>
  ),
  mission_gear: () => (
    <g>
      <path d="M36 84c0-22 4-38 24-38 8 0 18 6 24 22v16z" fill={TEAL} />
      <path d="M52 56c10 0 20 8 24 20" stroke={WHITE} {...stroke} strokeWidth="4" opacity=".7" />
      <path d="M36 84h48v6H36z" fill="#2F7772" />
      <circle cx="46" cy="94" r="5" fill={INK} />
      <circle cx="76" cy="94" r="5" fill={INK} />
    </g>
  ),
  mission_care: () => (
    <g>
      <path d="M60 90S34 74 34 56a15 15 0 0 1 26-9 15 15 0 0 1 26 9c0 18-26 34-26 34z" fill="#E4586F" />
      <path d="M52 40c-8 0-12 6-12 12" {...stroke} strokeWidth="3.5" stroke="#F6A1B0" />
    </g>
  ),
  mission_learning: () => (
    <g>
      <path d="M60 34a22 22 0 0 0-12 40v8h24v-8a22 22 0 0 0-12-40z" fill={SUN} />
      <rect x="49" y="84" width="22" height="7" rx="3" fill="#B98414" />
      <path d="M54 74V62l6-6 6 6v12" {...stroke} strokeWidth="3" stroke="#B98414" />
    </g>
  ),
  mission_rest: () => (
    <g>
      <path d="M78 36a26 26 0 1 0 12 40 22 22 0 0 1-12-40z" fill={PLUM} />
      <path d="M40 40h14l-14 14h14" {...stroke} strokeWidth="3.5" stroke={PLUM} />
      <circle cx="84" cy="52" r="3" fill={SUN} />
    </g>
  ),
  mission_together: () => (
    <g>
      <path d="M46 84S26 70 26 56a12 12 0 0 1 20-8 12 12 0 0 1 20 8c0 14-20 28-20 28z" fill={TERRA} />
      <path d="M76 90S52 74 52 58a13 13 0 0 1 24-7 13 13 0 0 1 24 7c0 16-24 32-24 32z" fill={TEAL} />
    </g>
  ),
  baby_first_practice: () => (
    <g>
      <circle cx="60" cy="62" r="26" fill={SKIN} />
      <path d="M52 38c4-6 12-6 16 0" {...stroke} strokeWidth="4" stroke="#8A6A3E" />
      <Face x={60} y={64} s={0.4} />
    </g>
  ),
  baby_48h: () => (
    <g>
      <circle cx="60" cy="60" r="28" fill={WHITE} stroke={TEAL} strokeWidth="4" />
      <path d="M60 60V44M60 60l12 8" {...stroke} stroke={TEAL} />
      <circle cx="60" cy="60" r="3" fill={TEAL} />
      <path d="M60 33V28M60 92v-5M33 60h-5M92 60h-5" {...stroke} strokeWidth="3" stroke={TEAL} />
      <circle cx="86" cy="86" r="12" fill={SKIN} stroke={WHITE} strokeWidth="3" />
      <Face x={86} y={87} s={0.17} />
    </g>
  ),
};

/** The disc colour of each sticker; paths cycle through the set. */
const pathTones: ToneName[] = ["leaf", "sun", "terra", "teal", "sky", "plum"];

function resolve(art: string): { glyph: (t: Tone) => ReactNode; tone: ToneName; together: boolean } {
  const together = art.startsWith("together_");
  const id = art.replace(/^(path|together)_/, "");
  if (art === "book") return { glyph: (t) => <Book t={t} />, tone: "sun", together: false };
  if (art.startsWith("path_") || together) {
    const known = Object.keys(glyphs).indexOf(id);
    return { glyph: glyphs[id] ?? glyphs.rosette, tone: pathTones[(known < 0 ? 0 : known) % pathTones.length], together };
  }
  const toneByArt: Record<string, ToneName> = {
    mission_first: "terra", mission_both: "sun", mission_meals: "sun", mission_home: "teal", mission_gear: "sky",
    mission_care: "terra", mission_learning: "sun", mission_rest: "plum", mission_together: "leaf",
    baby_first_practice: "terra", baby_48h: "teal",
  };
  return { glyph: glyphs[art] ?? glyphs.rosette, tone: toneByArt[art] ?? "leaf", together: false };
}

/**
 * One sticker. `locked` draws the open slot: a dashed outline and a faded
 * glyph, so the book shows what is still to find without a "nothing yet".
 */
export function StickerArt({ art, locked = false, title, className, style }: { art: string; locked?: boolean; title?: string; className?: string; style?: React.CSSProperties }) {
  const { glyph, tone, together } = resolve(art);
  const t = tones[tone];
  return (
    <svg viewBox="0 0 120 120" className={className} style={style} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} overflow="visible">
      {locked ? (
        <>
          <circle cx="60" cy="60" r="50" fill="#F4EEE4" stroke="#CFC6B8" strokeWidth="3" strokeDasharray="5 7" strokeLinecap="round" />
          <g opacity=".28" style={{ filter: "grayscale(1)" }}>{glyph(t)}</g>
        </>
      ) : (
        <>
          <circle cx="60" cy="60" r="55" fill={WHITE} />
          <circle cx="60" cy="60" r="48" fill={t.disc} />
          {together && <circle cx="60" cy="60" r="43" fill="none" stroke={t.line} strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" opacity=".6" />}
          {glyph(t)}
          {together && (
            <g transform="translate(86 90)">
              <circle r="12" fill={WHITE} />
              <path d="M0 8S-9 3-9-3a5 5 0 0 1 9-2 5 5 0 0 1 9 2C9 3 0 8 0 8z" fill="#E4586F" />
            </g>
          )}
        </>
      )}
    </svg>
  );
}
