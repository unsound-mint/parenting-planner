import { cn } from "@/lib/utils";

export type Mood = 1 | 2 | 3 | 4 | 5;

// One soft blob, five faces. Colours run from a cool grey (heavy) to a warm
// apricot (glowing); the face carries the meaning, so colour is never the only cue.
// mood matches MoodCheckin.mood (1 to 5) in the API.
export const MOODS: Record<Mood, { label: string; fill: string; mouth: string; closedEyes?: boolean }> = {
  1: { label: "Heavy", fill: "#CBD3DA", mouth: "M24 44c5-5 11-5 16 0", closedEyes: true },
  2: { label: "Low", fill: "#E6D7BC", mouth: "M25 43c4-3 10-3 14 0" },
  3: { label: "Okay", fill: "#F3E0A6", mouth: "M25 41h14" },
  4: { label: "Good", fill: "#F7CB92", mouth: "M24 39c4 5 12 5 16 0" },
  5: { label: "Glowing", fill: "#F2AB78", mouth: "M22 37c4 9 16 9 20 0z" },
};

const BLOB = "M32 4c11 0 21 6 25 15s3 21-3 29-17 12-27 11S8 53 5 44 3 24 9 15 21 4 32 4z";
const INK = "#3A2F28";

/**
 * A mood as a face. Decorative by default (the label sits next to it); pass
 * `title` when the face stands alone, e.g. on a journal entry.
 * Size it with className (size-11 in a list, size-13 in the picker).
 */
export function MoodFace({ mood, className, title }: { mood: Mood; className?: string; title?: string }) {
  const m = MOODS[mood];
  return (
    <svg viewBox="0 0 64 64" className={cn("size-11 shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {/* Each face leans a little differently, so a row of them looks hand-drawn. */}
      <path d={BLOB} fill={m.fill} transform={`rotate(${(mood - 3) * 8} 32 32)`} />
      {m.closedEyes ? (
        <path d="M22 28h6M36 28h6" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="25" cy="29" r="3.2" fill={INK} />
          <circle cx="39" cy="29" r="3.2" fill={INK} />
        </>
      )}
      {mood >= 4 && (
        <>
          <circle cx="19" cy="37" r="4" fill="#E9866A" opacity=".35" />
          <circle cx="45" cy="37" r="4" fill="#E9866A" opacity=".35" />
        </>
      )}
      {mood === 5 ? <path d={m.mouth} fill={INK} /> : <path d={m.mouth} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
