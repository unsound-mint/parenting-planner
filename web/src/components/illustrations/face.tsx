import styles from "./styles";

/** "smile" is the face every illustration wears; the others are the Virtual Baby's needs. */
export type FaceExpression = "smile" | "hungry" | "fussy" | "sleepy" | "asleep";

type FaceProps = {
  x: number;
  y: number;
  /** 1 is the size used on the zucchini (about 80 units wide with cheeks). */
  s?: number;
  rotate?: number;
  expression?: FaceExpression;
};

const INK = "#2B2620";

/**
 * The one face every illustration wears. Drawn around (0,0) and placed with
 * x, y and s. Eyes blink through the .eyes CSS class (closed eyes do not).
 */
export function Face({ x, y, s = 1, rotate = 0, expression = "smile" }: FaceProps) {
  const sleepy = expression === "sleepy";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <circle cx="-34" cy="14" r="10" fill="#F3B08A" opacity={expression === "fussy" ? 0.95 : 0.7} />
      <circle cx="34" cy="14" r="10" fill="#F3B08A" opacity={expression === "fussy" ? 0.95 : 0.7} />
      {expression === "asleep" ? (
        <path d="M-26 -3c4 4 10 4 14 0M12 -3c4 4 10 4 14 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      ) : (
        <g className={styles.eyes}>
          <ellipse cx="-19" cy={sleepy ? -1 : -4} rx="6.5" ry={sleepy ? 3.6 : 8} fill={INK} />
          <ellipse cx="19" cy={sleepy ? -1 : -4} rx="6.5" ry={sleepy ? 3.6 : 8} fill={INK} />
          {sleepy ? (
            <path d="M-27 -5h16M11 -5h16" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="-17" cy="-7" r="2.2" fill="#fff" />
              <circle cx="21" cy="-7" r="2.2" fill="#fff" />
            </>
          )}
          {expression === "fussy" && <path d="M-28 -18l12 4M28 -18l-12 4" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />}
        </g>
      )}
      {expression === "hungry" ? (
        <ellipse cx="0" cy="15" rx="5.5" ry="6.5" fill={INK} />
      ) : expression === "fussy" ? (
        <path d="M-9 19c5-7 13-7 18 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      ) : expression === "asleep" || sleepy ? (
        <path d="M-5 13c3 3 7 3 10 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M-8 12c5 6 12 6 16 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      )}
    </g>
  );
}
