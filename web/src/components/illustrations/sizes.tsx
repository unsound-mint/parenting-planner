import type { ReactNode } from "react";
import { useId } from "react";
import { Face } from "./face";

/* Flat shapes on a 300x260 canvas, palette from the journey comp. Each
   shape draws its own body and places the shared Face. */

type Variant<T> = { v?: T };

const LEAF = "#6E9F52";
const LEAF_D = "#4F7F45";
const STEM = "#8A6A3E";

function Leaf({ d, fill = LEAF }: { d: string; fill?: string }) {
  return <path d={d} fill={fill} />;
}

function Seed({ kind }: { kind: "poppy" | "sesame" }) {
  const poppy = kind === "poppy";
  return (
    <g>
      <path
        d={
          poppy
            ? "M92 140c0-50 50-70 90-52 40 18 52 70 14 98-40 28-104 4-104-46z"
            : "M70 150c0-50 80-70 150-30 18 10 24 20 22 26-8 36-100 62-150 20-14-10-22-14-22-16z"
        }
        fill={poppy ? "#6C7A96" : "#F1DEB4"}
      />
      <path
        d={poppy ? "M108 110c10-20 36-28 56-22" : "M96 118c30-20 80-16 116 6"}
        stroke={poppy ? "#8E9BB8" : "#FFF3D6"}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <Face x={150} y={146} s={0.85} />
    </g>
  );
}

function Pea() {
  return (
    <g>
      <path d="M150 82c0-14 10-22 26-20" stroke={LEAF_D} strokeWidth="5" strokeLinecap="round" fill="none" />
      <Leaf d="M150 86c-20-26-46-22-52-12 10 14 34 20 52 12z" />
      <circle cx="150" cy="150" r="66" fill="#8DC46B" />
      <path d="M96 176c30 28 84 28 108-4" stroke="#6FA84F" strokeWidth="12" strokeLinecap="round" fill="none" opacity=".6" />
      <ellipse cx="114" cy="112" rx="12" ry="7" fill="#C9E5A8" opacity=".8" transform="rotate(-35 114 112)" />
      <Face x={150} y={152} s={0.95} />
    </g>
  );
}

function Grape() {
  return (
    <g>
      <path d="M150 84c2-16 8-24 18-30" stroke={STEM} strokeWidth="6" strokeLinecap="round" fill="none" />
      <Leaf d="M164 62c16-18 40-16 46-6-8 16-30 22-46 6z" />
      <circle cx="150" cy="150" r="66" fill="#8A5FB0" />
      <path d="M96 176c30 28 84 28 108-4" stroke="#6C468F" strokeWidth="12" strokeLinecap="round" fill="none" opacity=".6" />
      <ellipse cx="112" cy="112" rx="14" ry="8" fill="#B8A0D4" opacity=".85" transform="rotate(-35 112 112)" />
      <Face x={150} y={154} s={0.95} />
    </g>
  );
}

function Raspberry() {
  const dots: ReactNode[] = [];
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 9; gx++) {
      const x = 82 + gx * 17 + (gy % 2) * 8;
      const y = 100 + gy * 15;
      const dx = (x - 150) / 70;
      const dy = (y - 150) / 62;
      if (dx * dx + dy * dy > 1) continue;
      if (Math.abs(x - 150) < 52 && Math.abs(y - 152) < 26) continue;
      dots.push(<circle key={`${gx}-${gy}`} cx={x} cy={y} r="9" fill="#EE6B7E" stroke="#C93A50" strokeWidth="2" />);
    }
  }
  return (
    <g>
      <ellipse cx="150" cy="152" rx="68" ry="62" fill="#D9455B" />
      {dots}
      <Leaf d="M150 94c-14-18-34-22-44-14 8 14 26 20 44 14zM150 94c14-18 34-22 44-14-8 14-26 20-44 14zM150 94c-4-14 0-26 6-32-2 12-2 22-6 32z" fill={LEAF} />
      <Face x={150} y={154} s={0.85} />
    </g>
  );
}

function Strawberry() {
  const seeds: [number, number][] = [[104,120],[196,120],[92,150],[208,150],[110,184],[190,184],[130,206],[170,206],[150,106],[124,98],[176,98]];
  return (
    <g>
      <path d="M150 222C92 196 76 152 80 122c4-30 40-34 70-20 30-14 66-10 70 20 4 30-12 74-70 100z" fill="#E5484D" />
      <path d="M96 186c-14-20-16-44-12-58" stroke="#F5878A" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".7" />
      {seeds.map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="3" ry="4.5" fill="#FBD9A0" />
      ))}
      <Leaf d="M150 100c-30 4-56-4-62-18 18-4 44 0 62 18zM150 100c30 4 56-4 62-18-18-4-44 0-62 18zM150 100c-14-12-20-26-12-38 10 8 16 22 12 38zM150 100c14-12 20-26 12-38-10 8-16 22-12 38z" />
      <Face x={150} y={150} s={0.9} />
    </g>
  );
}

const STONE = {
  apricot: { body: "#F6A94B", shade: "#E8923A", hi: "#FBD08E", blush: "#F28A5A" },
  peach: { body: "#F7B09A", shade: "#EE8A6E", hi: "#FCD6C8", blush: "#EE7B6A" },
  plum: { body: "#7A5AA6", shade: "#5F4488", hi: "#A68CCB", blush: "#7A5AA6" },
} as const;

function StoneFruit({ v = "peach" }: Variant<keyof typeof STONE>) {
  const c = STONE[v];
  return (
    <g>
      <path d="M150 90c2-12 6-18 12-22" stroke={STEM} strokeWidth="6" strokeLinecap="round" fill="none" />
      <Leaf d="M158 80c18-20 42-18 48-8-8 16-32 22-48 8z" />
      <circle cx="150" cy="152" r="66" fill={c.body} />
      <path d="M120 100c20 4 34 20 34 50s-6 52-4 62" stroke={c.shade} strokeWidth="7" strokeLinecap="round" fill="none" opacity=".55" />
      <path d="M190 190c-20 24-60 28-90 6" stroke={c.shade} strokeWidth="14" strokeLinecap="round" fill="none" opacity=".35" />
      <ellipse cx="204" cy="120" rx="10" ry="16" fill={c.blush} opacity=".25" />
      <ellipse cx="112" cy="116" rx="14" ry="8" fill={c.hi} opacity=".8" transform="rotate(-35 112 116)" />
      <Face x={150} y={158} s={0.95} />
    </g>
  );
}

function Fig() {
  return (
    <g>
      <path d="M150 62c10 0 12 8 12 14" stroke={STEM} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M150 74c14 0 18 22 30 42 30 34 30 100-30 104-60-4-60-70-30-104 12-20 16-42 30-42z" fill="#8B5A7E" />
      <path d="M118 140c-8 20-6 44 6 62M182 140c8 20 6 44-6 62" stroke="#A97A9C" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".6" />
      <ellipse cx="126" cy="116" rx="8" ry="14" fill="#B58BAB" opacity=".7" transform="rotate(20 126 116)" />
      <Face x={150} y={166} s={0.9} />
    </g>
  );
}

function Kiwi() {
  const seeds = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [150 + Math.cos(a) * 49, 150 + Math.sin(a) * 49] as const;
  });
  return (
    <g>
      <circle cx="150" cy="150" r="72" fill="#A6845A" />
      <circle cx="150" cy="150" r="64" fill="#8FC25E" />
      <circle cx="150" cy="150" r="38" fill="#CFE7A8" />
      {seeds.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="2.6" ry="5" fill="#2B2620" transform={`rotate(${(i / 14) * 360 + 90} ${x} ${y})`} />
      ))}
      <Face x={150} y={152} s={0.72} />
    </g>
  );
}

function Apple({ v = "apple" }: Variant<"apple" | "pomegranate">) {
  if (v === "pomegranate") {
    return (
      <g>
        <circle cx="150" cy="152" r="68" fill="#C93A4A" />
        <path d="M100 196c26 22 76 24 100-4" stroke="#A82A3C" strokeWidth="14" strokeLinecap="round" fill="none" opacity=".5" />
        <path d="M122 92l10-24 12 14 6-20 6 20 12-14 10 24z" fill="#B02E40" />
        <ellipse cx="112" cy="118" rx="14" ry="8" fill="#E8808A" opacity=".8" transform="rotate(-35 112 118)" />
        <Face x={150} y={158} s={0.95} />
      </g>
    );
  }
  return (
    <g>
      <path d="M150 104c-26-22-72-12-72 36 0 50 38 84 72 74 34 10 72-24 72-74 0-48-46-58-72-36z" fill="#E9594A" />
      <path d="M96 192c28 22 80 24 110-6" stroke="#C94238" strokeWidth="14" strokeLinecap="round" fill="none" opacity=".4" />
      <ellipse cx="108" cy="124" rx="12" ry="18" fill="#F58E80" opacity=".75" transform="rotate(25 108 124)" />
      <path d="M150 104c0-14 4-24 12-32" stroke={STEM} strokeWidth="6" strokeLinecap="round" fill="none" />
      <Leaf d="M160 84c14-20 40-20 46-10-8 16-28 22-46 10z" />
      <Face x={150} y={158} s={0.95} />
    </g>
  );
}

function Avocado() {
  return (
    <g>
      <path d="M150 52c26 0 34 36 50 68 26 40 16 100-50 100S74 160 100 120c16-32 24-68 50-68z" fill="#3F6B37" />
      <path d="M118 150c-10 22-4 46 14 58" stroke="#5E8F4B" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".7" />
      <ellipse cx="122" cy="104" rx="8" ry="16" fill="#7FB067" opacity=".8" transform="rotate(20 122 104)" />
      <Face x={150} y={162} s={0.9} />
    </g>
  );
}

function Pepper() {
  return (
    <g>
      <path d="M92 112c-16 24-14 78 10 98 22 18 38-4 48 0 10-4 26 18 48 0 24-20 26-74 10-98-14-18-40-12-58-6-18-6-44-12-58 6z" fill="#E4473A" />
      <path d="M120 112c-10 30-6 70 8 94M180 112c10 30 6 70-8 94" stroke="#C2342B" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".5" />
      <ellipse cx="108" cy="134" rx="8" ry="16" fill="#F08075" opacity=".8" transform="rotate(10 108 134)" />
      <path d="M150 104c-2-14 4-24 14-30" stroke="#4F7F45" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M126 112c8-10 20-12 24-8 4-4 16-2 24 8-8 6-16 6-24 4-8 2-16 2-24-4z" fill="#4F7F45" />
      <Face x={150} y={158} s={0.95} />
    </g>
  );
}

function Tomato() {
  return (
    <g>
      <ellipse cx="150" cy="156" rx="76" ry="64" fill="#E9473B" />
      <path d="M90 196c30 22 90 22 120 0" stroke="#C93A30" strokeWidth="14" strokeLinecap="round" fill="none" opacity=".4" />
      <ellipse cx="106" cy="124" rx="14" ry="8" fill="#F58A80" opacity=".8" transform="rotate(-30 106 124)" />
      <path d="M150 100l-22-14 6 20-26 2 24 12-10 18 22-8 6 16 6-16 22 8-10-18 24-12-26-2 6-20z" fill="#4F7F45" />
      <Face x={150} y={162} s={0.95} />
    </g>
  );
}

function Banana() {
  return (
    <g transform="rotate(-6 150 150)">
      <path d="M70 108Q148 238 236 126" stroke="#E0A93A" strokeWidth="68" strokeLinecap="round" fill="none" />
      <path d="M70 108Q148 238 236 126" stroke="#F6D55C" strokeWidth="58" strokeLinecap="round" fill="none" />
      <path d="M84 110Q150 206 226 122" stroke="#FBE58C" strokeWidth="10" strokeLinecap="round" fill="none" opacity=".7" />
      <path d="M232 112l14-22" stroke="#8A6A3E" strokeWidth="16" strokeLinecap="round" />
      <circle cx="62" cy="96" r="8" fill="#5A4430" />
      <Face x={152} y={172} s={0.82} rotate={4} />
    </g>
  );
}

function Carrot() {
  return (
    <g transform="rotate(-24 150 140)">
      <path d="M150 76c-18-26-22-44-10-54 10 6 14 24 10 54zM150 76c0-30 8-48 22-54 6 12 0 32-22 54zM150 76c18-22 36-30 52-26-6 14-26 24-52 26z" fill={LEAF} />
      <path d="M96 84c0-12 108-12 108 0 0 44-30 114-54 148-24-34-54-104-54-148z" fill="#F08A3C" />
      <path d="M112 128c10 4 18 4 26 0M164 160c10 4 18 4 24 0M128 184c8 4 14 4 20 0" stroke="#D86F24" strokeWidth="4" strokeLinecap="round" fill="none" />
      <ellipse cx="112" cy="104" rx="5" ry="16" fill="#F8B27A" opacity=".8" />
      <Face x={150} y={124} s={0.85} rotate={24} />
    </g>
  );
}

function Tuber() {
  return (
    <g transform="rotate(-8 150 150)">
      <path d="M52 158c0-50 66-66 130-52 50 10 74 38 60 70-18 36-100 46-146 26-24-10-44-22-44-44z" fill="#B5654D" />
      <path d="M52 158c-10-4-18 0-24 6M240 178c10 2 20-2 28-8" stroke="#8E4B38" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M96 206c40 14 90 8 126-10" stroke="#9A5440" strokeWidth="12" strokeLinecap="round" fill="none" opacity=".5" />
      <ellipse cx="100" cy="128" rx="20" ry="7" fill="#D98C70" opacity=".8" transform="rotate(-18 100 128)" />
      <Face x={152} y={160} s={0.9} rotate={8} />
    </g>
  );
}

function Mango() {
  return (
    <g transform="rotate(-10 150 150)">
      <path d="M68 150c0-62 82-82 140-54 48 24 40 92-8 112-52 22-132 4-132-58z" fill="#F4B13E" />
      <path d="M200 100c36 24 30 82-8 104-14 6-30 8-46 6 44-6 70-50 54-110z" fill="#E8654A" opacity=".55" />
      <path d="M72 140c-2-30 20-52 48-60-24 18-34 40-32 70z" fill="#A9C855" opacity=".7" />
      <path d="M150 90c0-10 6-18 14-22" stroke={STEM} strokeWidth="6" strokeLinecap="round" fill="none" />
      <ellipse cx="112" cy="118" rx="16" ry="8" fill="#FBD58A" opacity=".8" transform="rotate(-30 112 118)" />
      <Face x={150} y={158} s={0.95} rotate={8} />
    </g>
  );
}

function Corn() {
  return (
    <g transform="rotate(14 150 150)">
      <rect x="116" y="42" width="68" height="176" rx="34" fill="#F4CD6A" />
      <g stroke="#E5B24A" strokeWidth="3" opacity=".9">
        <path d="M134 56v34M150 50v40M166 56v34M124 70h52M122 84h56M134 168v40M150 168v46M166 168v40M124 184h52M128 198h44" />
      </g>
      <path d="M150 232c-60-8-72-70-52-110 8 30 28 56 52 70zM150 232c60-8 72-70 52-110-8 30-28 56-52 70z" fill="#7FAE63" />
      <path d="M150 232c-26-30-30-62-24-90 10 24 22 52 24 90z" fill="#9CC47E" />
      <Face x={150} y={128} s={0.78} rotate={-14} />
    </g>
  );
}

const CUC = {
  zucchini: { body: "#7FAE63", s1: "#5F8E4F", s2: "#4F7F45", mid: "#A9CB86", h: 88, blossom: true },
  cucumber: { body: "#5E9B4E", s1: "#4A8340", s2: "#3F6B37", mid: "#8DC275", h: 80, blossom: false },
} as const;

/** The comp's zucchini; the cucumber reuses it with its own colours. */
function Zucchini({ v = "zucchini" }: Variant<keyof typeof CUC>) {
  const c = CUC[v];
  const id = `zc-${useId().replace(/:/g, "")}`;
  const y0 = 162 - c.h / 2;
  return (
    <g transform="rotate(-12 150 162)">
      <path d="M40 150c-14-2-22 4-24 12s6 14 22 12z" fill="#6E8F4E" />
      <path d="M18 160c-6-1-10 1-12 4" stroke="#8A6A3E" strokeWidth="5" strokeLinecap="round" fill="none" />
      <clipPath id={id}>
        <rect x="34" y={y0} width="226" height={c.h} rx={c.h / 2} />
      </clipPath>
      <rect x="34" y={y0} width="226" height={c.h} rx={c.h / 2} fill={c.body} />
      <g clipPath={`url(#${id})`}>
        <path d={`M30 ${y0 + 18}c70-10 160-10 234 0M30 ${y0 + c.h - 16}c70 10 160 10 234 0`} stroke={c.s1} strokeWidth="9" fill="none" />
        <path d={`M30 ${y0 + 6}c70-12 160-12 234 0`} stroke={c.s2} strokeWidth="12" fill="none" />
        <ellipse cx="150" cy="168" rx="98" ry="26" fill={c.mid} opacity=".55" />
        <g fill="#C9DFAE" opacity=".8">
          <circle cx="72" cy="150" r="2.5" /><circle cx="96" cy="186" r="2" /><circle cx="214" cy="144" r="2.5" /><circle cx="232" cy="182" r="2" /><circle cx="190" cy="190" r="2" />
        </g>
        <path d={`M34 ${y0 + c.h + 8}c70-16 156-16 226 0`} stroke={c.s2} strokeWidth="16" fill="none" opacity=".5" />
      </g>
      {c.blossom && (
        <g transform="translate(262 160)">
          <path d="M0 0c10-22 30-26 36-14S26 8 0 0z" fill="#F4CD6A" />
          <path d="M0 0c22-6 38 6 32 18S10 20 0 0z" fill="#F2B84B" />
          <path d="M0 0c16 10 18 30 6 34S-4 18 0 0z" fill="#F4CD6A" />
          <circle cx="2" cy="2" r="5" fill="#E8A040" />
        </g>
      )}
      <Face x={152} y={162} s={0.95} rotate={12} />
    </g>
  );
}

function Cauliflower() {
  const florets: [number, number, number][] = [[150,82,34],[104,100,34],[196,100,34],[84,146,32],[216,146,32],[110,190,32],[190,190,32],[150,200,34]];
  return (
    <g>
      <path d="M150 226c-62 0-84-40-78-84 14 28 40 46 78 52zM150 226c62 0 84-40 78-84-14 28-40 46-78 52z" fill="#7FAE63" />
      <path d="M150 226c-30-10-44-30-46-58 18 14 34 22 46 28z" fill="#9CC47E" />
      {florets.map(([x, y, r]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#F6EEDB" stroke="#E4D6B2" strokeWidth="3" />
      ))}
      <circle cx="150" cy="144" r="58" fill="#F6EEDB" />
      <Face x={150} y={146} s={0.92} />
    </g>
  );
}

function Eggplant() {
  return (
    <g transform="rotate(-8 150 150)">
      <path d="M150 66c28 6 30 40 54 62 36 34 16 98-48 98-64 2-90-50-60-92 22-30 20-62 54-68z" fill="#6A3F8F" />
      <path d="M96 190c20 22 62 28 98 6" stroke="#4E2B70" strokeWidth="12" strokeLinecap="round" fill="none" opacity=".5" />
      <ellipse cx="108" cy="138" rx="8" ry="22" fill="#9A72BD" opacity=".7" transform="rotate(18 108 138)" />
      <path d="M150 66c0-16 8-26 24-30" stroke="#4F7F45" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M118 76c10-12 24-14 32-8 8-6 22-4 32 8-10 8-22 10-32 6-10 4-22 2-32-6z" fill="#4F7F45" />
      <Face x={150} y={166} s={0.88} rotate={8} />
    </g>
  );
}

function Squash() {
  return (
    <g>
      <path d="M130 44c0-8 40-8 40 0 0 30 4 52 28 78 32 34 22 100-48 100S70 156 102 122c24-26 28-48 28-78z" fill="#E8B26A" />
      <path d="M96 192c28 22 80 24 108-4" stroke="#D89A4A" strokeWidth="14" strokeLinecap="round" fill="none" opacity=".55" />
      <path d="M130 70c-2 20-8 38-22 56" stroke="#F4CE94" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".8" />
      <rect x="140" y="30" width="20" height="22" rx="6" fill={STEM} />
      <Face x={150} y={170} s={0.92} />
    </g>
  );
}

function Cabbage() {
  return (
    <g>
      <circle cx="150" cy="150" r="70" fill="#6E9F52" />
      <path d="M90 130c-10 40 10 80 60 84-30-26-36-60-26-92z" fill="#8CBF6C" />
      <path d="M210 130c10 40-10 80-60 84 30-26 36-60 26-92z" fill="#8CBF6C" />
      <circle cx="150" cy="140" r="52" fill="#A5D086" />
      <path d="M104 118c16-20 76-20 92 0M112 100c14-12 62-12 76 0" stroke="#C8E3B0" strokeWidth="5" strokeLinecap="round" fill="none" />
      <Face x={150} y={152} s={0.88} />
    </g>
  );
}

function Coconut() {
  return (
    <g>
      <circle cx="150" cy="150" r="72" fill="#7A5B3E" />
      <path d="M90 100l-10-12M120 82l-4-14M180 82l4-14M210 100l10-12M84 184l-14 6M216 184l14 6" stroke="#5A4430" strokeWidth="5" strokeLinecap="round" />
      <circle cx="150" cy="150" r="58" fill="#FFF8EA" />
      <path d="M100 124c10-22 34-34 56-30" stroke="#EDE0C6" strokeWidth="8" strokeLinecap="round" fill="none" />
      <Face x={150} y={154} s={0.95} />
    </g>
  );
}

function Pineapple() {
  const id = `pa-${useId().replace(/:/g, "")}`;
  return (
    <g>
      <path d="M150 104c-16-30-30-48-22-66 12 8 20 28 22 66zM150 104c0-34 4-54 14-66 12 14 10 36-14 66zM150 104c14-22 34-34 56-34-8 18-28 30-56 34zM150 104c-14-22-34-34-56-34 8 18 28 30 56 34z" fill="#4F7F45" />
      <clipPath id={id}>
        <ellipse cx="150" cy="168" rx="56" ry="70" />
      </clipPath>
      <ellipse cx="150" cy="168" rx="56" ry="70" fill="#F2B84B" />
      <g clipPath={`url(#${id})`} stroke="#D9923A" strokeWidth="3.5" opacity=".7">
        <path d="M70 120l160 120M70 150l130 100M70 190l90 60M70 100l140 110M110 90l120 90M170 90l60 50M230 120l-160 120M230 150l-130 100M230 190l-90 60M230 100l-140 110M190 90l-120 90M130 90l-60 50" />
      </g>
      <ellipse cx="150" cy="168" rx="38" ry="30" fill="#F8D27A" />
      <Face x={150} y={168} s={0.8} />
    </g>
  );
}

const MELON = {
  cantaloupe: { body: "#E8C48A", net: "#C9A56A", hi: "#F4DDB0" },
  honeydew: { body: "#CDE3A0", net: "#B3CE84", hi: "#E6F2C8" },
} as const;

function Melon({ v = "cantaloupe" }: Variant<keyof typeof MELON>) {
  const c = MELON[v];
  return (
    <g>
      <circle cx="150" cy="152" r="72" fill={c.body} />
      <path d="M150 80c-26 24-26 120 0 144M150 80c26 24 26 120 0 144M150 80c-60 20-66 124 0 144M150 80c60 20 66 124 0 144" stroke={c.net} strokeWidth={v === "cantaloupe" ? 4 : 2.5} fill="none" opacity={v === "cantaloupe" ? 0.8 : 0.6} />
      {v === "cantaloupe" && <path d="M84 120c40 16 92 16 132 0M80 160c44 16 96 16 140 0M92 198c36 10 80 10 116 0" stroke={c.net} strokeWidth="3" fill="none" opacity=".7" />}
      <ellipse cx="150" cy="158" rx="46" ry="36" fill={c.body} />
      <ellipse cx="108" cy="112" rx="14" ry="8" fill={c.hi} opacity=".9" transform="rotate(-35 108 112)" />
      <rect x="143" y="72" width="14" height="16" rx="5" fill={STEM} />
      <Face x={150} y={160} s={0.95} />
    </g>
  );
}

function Watermelon() {
  return (
    <g>
      <ellipse cx="150" cy="156" rx="86" ry="68" fill="#5E9B4E" />
      <path d="M150 88c-30 14-30 124 0 136M150 88c30 14 30 124 0 136M150 88c-62 20-66 116-30 130M150 88c62 20 66 116 30 130" stroke="#3F6B37" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".75" />
      <ellipse cx="150" cy="160" rx="52" ry="38" fill="#6FAE5E" />
      <ellipse cx="100" cy="118" rx="16" ry="8" fill="#9CCB88" opacity=".8" transform="rotate(-30 100 118)" />
      <path d="M150 90c0-10 6-16 14-20" stroke={STEM} strokeWidth="7" strokeLinecap="round" fill="none" />
      <Face x={150} y={162} s={0.98} />
    </g>
  );
}

function Pumpkin() {
  return (
    <g>
      <ellipse cx="102" cy="160" rx="46" ry="64" fill="#E67A2C" />
      <ellipse cx="198" cy="160" rx="46" ry="64" fill="#E67A2C" />
      <ellipse cx="124" cy="158" rx="42" ry="70" fill="#F08A3C" />
      <ellipse cx="176" cy="158" rx="42" ry="70" fill="#F08A3C" />
      <ellipse cx="150" cy="158" rx="38" ry="72" fill="#F59A4C" />
      <path d="M124 100c-14 30-14 90 0 116M176 100c14 30 14 90 0 116M82 120c-10 24-8 56 6 78M218 120c10 24 8 56-6 78" stroke="#D96A20" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".6" />
      <path d="M144 90c-2-12 2-20 6-26h8c4 6 6 14 2 26z" fill="#6E5A34" />
      <path d="M164 78c18-10 32-4 34 6" stroke={LEAF} strokeWidth="5" strokeLinecap="round" fill="none" />
      <Face x={150} y={162} s={0.98} />
    </g>
  );
}

type StalkKind = "celery" | "rhubarb";
const STALK = {
  celery: { stalk: "#A6CF7E", rib: "#8DBA66", leaf: "#6E9F52" },
  rhubarb: { stalk: "#CC4A5A", rib: "#A8323F", leaf: "#7FAE63" },
} as const;

function Stalks({ v = "celery" }: Variant<StalkKind>) {
  const c = STALK[v];
  return (
    <g>
      <g fill={c.stalk}>
        <rect x="84" y="66" width="44" height="164" rx="14" transform="rotate(-16 106 230)" />
        <rect x="172" y="66" width="44" height="164" rx="14" transform="rotate(16 194 230)" />
      </g>
      <rect x="116" y="62" width="68" height="170" rx="20" fill={c.stalk} />
      <path d="M134 80v140M166 80v140" stroke={c.rib} strokeWidth="4" strokeLinecap="round" opacity=".6" />
      <path d="M116 66c-20-4-44-26-38-44 22 4 40 20 38 44zM184 66c20-4 44-26 38-44-22 4-40 20-38 44zM150 60c-14-10-18-30-10-44 12 12 14 28 10 44z" fill={c.leaf} />
      <rect x="120" y="120" width="60" height="56" rx="20" fill={c.stalk} />
      <Face x={150} y={150} s={0.78} />
    </g>
  );
}

function Leek() {
  return (
    <g>
      <path d="M142 58c-44-14-64 20-54 60 22-4 50-30 54-60zM158 58c44-14 64 20 54 60-22-4-50-30-54-60zM150 44c-20 20-24 60-8 90h16c16-30 12-70-8-90z" fill="#6E9F52" />
      <path d="M150 52c-8 20-8 50-2 76" stroke="#8CBF6C" strokeWidth="5" strokeLinecap="round" fill="none" />
      <rect x="108" y="120" width="84" height="108" rx="30" fill="#F4F0DE" />
      <path d="M108 140c20 8 64 8 84 0" stroke="#C6D9A6" strokeWidth="14" opacity=".8" fill="none" />
      <path d="M126 232l-6 14M142 232l-2 16M158 232l2 16M174 232l6 14" stroke="#D9CFA8" strokeWidth="4" strokeLinecap="round" />
      <Face x={150} y={180} s={0.78} />
    </g>
  );
}

function Romaine() {
  return (
    <g>
      <path d="M150 232C86 220 62 150 84 86c34 18 52 66 66 146z" fill="#6E9F52" />
      <path d="M150 232c64-12 88-82 66-146-34 18-52 66-66 146z" fill="#6E9F52" />
      <path d="M150 232c-44-16-56-84-30-128 22 18 30 70 30 128z" fill="#8CBF6C" />
      <path d="M150 232c44-16 56-84 30-128-22 18-30 70-30 128z" fill="#8CBF6C" />
      <path d="M150 232c-34-40-40-112 0-168 40 56 34 128 0 168z" fill="#C3E0A4" />
      <path d="M150 90v130" stroke="#E6F2C8" strokeWidth="5" strokeLinecap="round" opacity=".8" />
      <Face x={150} y={162} s={0.82} />
    </g>
  );
}

export type SizeShape =
  | "seed" | "pea" | "grape" | "raspberry" | "strawberry" | "stonefruit" | "fig" | "kiwi" | "apple"
  | "avocado" | "pepper" | "tomato" | "banana" | "carrot" | "tuber" | "mango" | "corn" | "zucchini"
  | "cauliflower" | "eggplant" | "squash" | "cabbage" | "coconut" | "pineapple" | "melon"
  | "watermelon" | "pumpkin" | "stalks" | "leek" | "romaine";

export const SHAPES: Record<SizeShape, (v?: string) => ReactNode> = {
  seed: (v) => <Seed kind={v === "sesame" ? "sesame" : "poppy"} />,
  pea: () => <Pea />,
  grape: () => <Grape />,
  raspberry: () => <Raspberry />,
  strawberry: () => <Strawberry />,
  stonefruit: (v) => <StoneFruit v={(v as keyof typeof STONE) ?? "peach"} />,
  fig: () => <Fig />,
  kiwi: () => <Kiwi />,
  apple: (v) => <Apple v={v === "pomegranate" ? "pomegranate" : "apple"} />,
  avocado: () => <Avocado />,
  pepper: () => <Pepper />,
  tomato: () => <Tomato />,
  banana: () => <Banana />,
  carrot: () => <Carrot />,
  tuber: () => <Tuber />,
  mango: () => <Mango />,
  corn: () => <Corn />,
  zucchini: (v) => <Zucchini v={v === "cucumber" ? "cucumber" : "zucchini"} />,
  cauliflower: () => <Cauliflower />,
  eggplant: () => <Eggplant />,
  squash: () => <Squash />,
  cabbage: () => <Cabbage />,
  coconut: () => <Coconut />,
  pineapple: () => <Pineapple />,
  melon: (v) => <Melon v={v === "honeydew" ? "honeydew" : "cantaloupe"} />,
  watermelon: () => <Watermelon />,
  pumpkin: () => <Pumpkin />,
  stalks: (v) => <Stalks v={v === "rhubarb" ? "rhubarb" : "celery"} />,
  leek: () => <Leek />,
  romaine: () => <Romaine />,
};
