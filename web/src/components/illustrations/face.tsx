import styles from "./styles";

type FaceProps = {
  x: number;
  y: number;
  /** 1 is the size used on the zucchini (about 80 units wide with cheeks). */
  s?: number;
  rotate?: number;
};

/**
 * The one face every illustration wears. Drawn around (0,0) and placed with
 * x, y and s. Eyes blink through the .eyes CSS class.
 */
export function Face({ x, y, s = 1, rotate = 0 }: FaceProps) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <circle cx="-34" cy="14" r="10" fill="#F3B08A" opacity=".7" />
      <circle cx="34" cy="14" r="10" fill="#F3B08A" opacity=".7" />
      <g className={styles.eyes}>
        <ellipse cx="-19" cy="-4" rx="6.5" ry="8" fill="#2B2620" />
        <ellipse cx="19" cy="-4" rx="6.5" ry="8" fill="#2B2620" />
        <circle cx="-17" cy="-7" r="2.2" fill="#fff" />
        <circle cx="21" cy="-7" r="2.2" fill="#fff" />
      </g>
      <path
        d="M-8 12c5 6 12 6 16 0"
        stroke="#2B2620"
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}
