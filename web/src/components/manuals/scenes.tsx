"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";
import { Face } from "@/components/illustrations/face";
import { ease } from "@/components/joy/motion";

// One flat illustration per manual step, keyed by the step's scene in
// api/internal/content/manuals.json. Each scene draws what is already done
// still and animates only the move this step teaches (the fold, the pat, the
// toy leaving the crib). Loops stop under reduced motion; MotionConfig in
// providers.tsx already drops the transforms.

const C = {
  blanket: "#E9BE79",
  blanketShade: "#D7A35C",
  blanketEdge: "#C48C45",
  skin: "#F5CDAE",
  skinShade: "#E9B48F",
  adult: "#E4AE8A",
  shirt: "#8DAE93",
  shirtShade: "#759A7C",
  wood: "#C9A27A",
  woodShade: "#AF8760",
  sheet: "#EEF2F1",
  ink: "#2B2620",
  leaf: "#5E8B66",
  clay: "#C0634A",
  slate: "#8A9AA6",
  paper: "#FBF6EE",
};

const enter: Transition = { duration: 0.7, ease: ease.out, delay: 0.15 };

function useLoop(seconds: number, delay = 0): Transition {
  const reduce = useReducedMotion();
  return reduce ? { duration: 0 } : { duration: seconds, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6, delay };
}

export function ManualScene({ scene, className }: { scene: string; className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-hidden>
      <SceneBody scene={scene} />
    </svg>
  );
}

function SceneBody({ scene }: { scene: string }) {
  const [manual] = scene.split("-");
  if (manual === "swaddle") return <Swaddle step={swaddleSteps.indexOf(scene)} />;
  switch (scene) {
    case "burp-when":
      return <BurpWhen />;
    case "burp-shoulder":
      return <BurpShoulder />;
    case "burp-lap":
      return <BurpLap />;
    case "burp-belly":
      return <BurpBelly />;
    case "burp-after":
      return <BurpAfter />;
    case "sleep-surface":
      return <Crib surface />;
    case "sleep-empty":
      return <Crib clutter />;
    case "sleep-back":
      return <Crib baby />;
    case "sleep-room":
      return <Room />;
    default:
      return <Swaddle step={5} />;
  }
}

/* Swaddle: seen from above. Each step adds one layer to the last. */

const swaddleSteps = ["swaddle-spread", "swaddle-place", "swaddle-left", "swaddle-right", "swaddle-bottom", "swaddle-check"];

function Swaddle({ step }: { step: number }) {
  const pulse = useLoop(1.6);
  const s = Math.max(step, 0);
  // Fresh layers animate in; earlier ones are drawn still.
  const fresh = (n: number) => (s === n ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: enter } : {});
  return (
    <g>
      {/* The blanket as a diamond with the top corner folded down. */}
      <path d="M200 30 L340 150 L200 285 L60 150 Z" fill={C.blanket} stroke={C.blanketEdge} strokeWidth="2" strokeLinejoin="round" />
      <motion.path
        d="M140 92 L260 92 L200 140 Z"
        fill={C.blanketShade}
        initial={s === 0 ? { scaleY: -1, opacity: 0.4 } : false}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={enter}
        style={{ originX: "200px", originY: "92px", transformBox: "view-box" }}
      />
      <line x1="140" y1="92" x2="260" y2="92" stroke={C.blanketEdge} strokeWidth="2" strokeLinecap="round" />

      {s >= 1 && (
        <motion.g {...(s === 1 ? { initial: { y: -24, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: enter } : {})}>
          {/* Legs bent up and out, then the body, arms and head. */}
          <path d="M182 196 q-30 18 -22 44 M218 196 q30 18 22 44" stroke={C.skinShade} strokeWidth="18" fill="none" strokeLinecap="round" />
          <rect x="172" y="120" width="56" height="86" rx="26" fill="#FFFFFF" stroke="#E8DED0" strokeWidth="2" />
          {s < 3 && <path d="M226 132 q22 16 18 44" stroke={C.skin} strokeWidth="14" fill="none" strokeLinecap="round" />}
          {s < 2 && <path d="M174 132 q-22 16 -18 44" stroke={C.skin} strokeWidth="14" fill="none" strokeLinecap="round" />}
          <circle cx="200" cy="96" r="30" fill={C.skin} />
          <Face x={200} y={96} s={0.36} expression={s >= 4 ? "asleep" : "smile"} />
        </motion.g>
      )}

      {s >= 2 && (
        <motion.path
          d="M60 150 L200 130 L246 176 L210 214 Z"
          fill={C.blanketShade}
          stroke={C.blanketEdge}
          strokeWidth="2"
          strokeLinejoin="round"
          initial={s === 2 ? { rotate: -70, opacity: 0.3 } : false}
          animate={{ rotate: 0, opacity: 1 }}
          transition={enter}
          style={{ originX: "60px", originY: "150px", transformBox: "view-box" }}
        />
      )}
      {s >= 3 && (
        <motion.path
          d="M340 150 L200 128 L152 178 L192 218 Z"
          fill={C.blanket}
          stroke={C.blanketEdge}
          strokeWidth="2"
          strokeLinejoin="round"
          initial={s === 3 ? { rotate: 70, opacity: 0.3 } : false}
          animate={{ rotate: 0, opacity: 1 }}
          transition={enter}
          style={{ originX: "340px", originY: "150px", transformBox: "view-box" }}
        />
      )}
      {s >= 4 && (
        <motion.g
          initial={s === 4 ? { y: 40, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={enter}
        >
          {/* A loose bottom fold: rounded, with room around the legs. */}
          <path d="M150 222 Q200 286 250 222 Q236 204 200 206 Q164 204 150 222 Z" fill={C.blanketShade} stroke={C.blanketEdge} strokeWidth="2" strokeLinejoin="round" />
        </motion.g>
      )}
      {s === 4 && (
        <motion.g {...fresh(4)}>
          <motion.ellipse cx="200" cy="232" rx="64" ry="34" fill="none" stroke={C.leaf} strokeWidth="3" strokeDasharray="6 7" animate={{ scale: [1, 1.06, 1] }} transition={pulse} style={{ transformBox: "fill-box", originX: "50%", originY: "50%" }} />
          <path d="M128 232 l-16 0 m6 -6 l-6 6 l6 6 M272 232 l16 0 m-6 -6 l6 6 l-6 6" stroke={C.leaf} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
      )}
      {s === 5 && (
        <motion.g initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={enter}>
          {/* Two fingers slid under the wrap at the chest. */}
          <rect x="214" y="150" width="70" height="13" rx="6.5" fill={C.adult} stroke={C.skinShade} strokeWidth="1.5" />
          <rect x="214" y="165" width="74" height="13" rx="6.5" fill={C.adult} stroke={C.skinShade} strokeWidth="1.5" />
          <path d="M282 146 q40 4 60 30 l-10 22 q-24 -18 -50 -16 Z" fill={C.adult} />
          <motion.circle cx="226" cy="164" r="26" fill="none" stroke={C.leaf} strokeWidth="3" animate={{ opacity: [0.2, 0.9, 0.2] }} transition={pulse} />
        </motion.g>
      )}
    </g>
  );
}

/* Burping: an adult and baby from the side, with a patting hand. */

function Pat({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  const loop = useLoop(0.5);
  return (
    <motion.g animate={{ y: [0, -9, 0] }} transition={{ ...loop, repeatDelay: 0.25 }}>
      <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
        <ellipse cx="0" cy="0" rx="20" ry="13" fill={C.adult} stroke={C.skinShade} strokeWidth="1.5" />
        <path d="M14 4 q22 6 44 4" stroke={C.shirt} strokeWidth="16" strokeLinecap="round" fill="none" />
      </g>
    </motion.g>
  );
}

function Adult({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-70 210 Q-74 70 0 60 Q74 70 70 210 Z" fill={C.shirt} />
      <rect x="-14" y="30" width="28" height="36" rx="10" fill={C.adult} />
      <circle cx="0" cy="0" r="40" fill={C.adult} />
      <path d="M-40 -6 Q-36 -46 0 -44 Q36 -46 40 -6 Q22 -26 0 -24 Q-22 -26 -40 -6 Z" fill="#6B4E3A" />
    </g>
  );
}

function BabyBody({ x, y, rotate = 0, expression = "smile" as const }: { x: number; y: number; rotate?: number; expression?: "smile" | "asleep" }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x="-24" y="18" width="48" height="66" rx="22" fill="#FFFFFF" stroke="#E8DED0" strokeWidth="2" />
      <path d="M-14 80 q-6 18 4 26 M14 80 q6 18 -4 26" stroke={C.skinShade} strokeWidth="13" fill="none" strokeLinecap="round" />
      <circle cx="0" cy="0" r="26" fill={C.skin} />
      <Face x={0} y={2} s={0.3} expression={expression} />
    </g>
  );
}

function Burp({ x, y }: { x: number; y: number }) {
  const loop = useLoop(1.8, 0.4);
  return (
    <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 1.1], y: [0, -12, -20] }} transition={loop} style={{ transformBox: "fill-box", originX: "50%", originY: "50%" }}>
      <circle cx={x} cy={y} r="8" fill="none" stroke={C.slate} strokeWidth="2.5" />
      <circle cx={x + 14} cy={y - 12} r="5" fill="none" stroke={C.slate} strokeWidth="2.5" />
    </motion.g>
  );
}

function BurpWhen() {
  const loop = useLoop(2.4);
  return (
    <g>
      {/* A bottle whose milk drops to the 60 to 90 mL band, then a pause. */}
      <g transform="translate(120 40)">
        <rect x="18" y="0" width="44" height="22" rx="8" fill={C.blanketShade} />
        <rect x="0" y="20" width="80" height="210" rx="22" fill="#FFFFFF" stroke="#D9CFC0" strokeWidth="3" />
        <motion.rect x="6" width="68" rx="16" fill="#FFF3DC" initial={{ y: 40, height: 184 }} animate={{ y: [40, 116, 116], height: [184, 108, 108] }} transition={loop} />
        {[70, 110, 150, 190].map((yy) => (
          <line key={yy} x1="54" x2="74" y1={yy} y2={yy} stroke="#CFC3B2" strokeWidth="2" />
        ))}
        <rect x="-6" y="100" width="92" height="34" rx="8" fill="none" stroke={C.leaf} strokeWidth="3" strokeDasharray="5 6" />
      </g>
      <g transform="translate(270 150)">
        <circle r="52" fill={C.paper} stroke={C.leaf} strokeWidth="3" />
        <rect x="-18" y="-22" width="12" height="44" rx="4" fill={C.leaf} />
        <rect x="6" y="-22" width="12" height="44" rx="4" fill={C.leaf} />
      </g>
    </g>
  );
}

function BurpShoulder() {
  return (
    <g>
      <Adult x={170} y={100} />
      <BabyBody x={236} y={118} rotate={-8} />
      <path d="M190 280 q40 -36 70 -60" stroke={C.shirtShade} strokeWidth="18" strokeLinecap="round" fill="none" />
      <Pat x={268} y={168} rotate={-20} />
      <Burp x={276} y={84} />
    </g>
  );
}

function BurpLap() {
  return (
    <g>
      {/* Seated adult in profile; baby sits on the knee, chin in a cupped hand. */}
      <rect x="100" y="230" width="220" height="22" rx="11" fill={C.woodShade} />
      <path d="M110 120 Q104 210 140 232 L280 232 Q292 214 270 206 L170 206 Q160 150 150 120 Z" fill={C.shirt} />
      <circle cx="132" cy="90" r="34" fill={C.adult} />
      <BabyBody x={240} y={112} />
      <path d="M180 170 Q220 150 246 140" stroke={C.shirtShade} strokeWidth="16" strokeLinecap="round" fill="none" />
      <ellipse cx="250" cy="136" rx="16" ry="9" fill={C.adult} stroke={C.skinShade} strokeWidth="1.5" />
      <Pat x={206} y={150} rotate={80} />
      <Burp x={286} y={74} />
    </g>
  );
}

function BurpBelly() {
  return (
    <g>
      {/* Adult lap as a level bench of legs; baby across it, head higher than chest. */}
      <rect x="60" y="200" width="290" height="40" rx="20" fill={C.shirt} />
      <rect x="60" y="240" width="40" height="50" rx="12" fill={C.shirtShade} />
      <rect x="310" y="240" width="40" height="50" rx="12" fill={C.shirtShade} />
      <g transform="rotate(-10 205 180)">
        <rect x="150" y="164" width="96" height="44" rx="22" fill="#FFFFFF" stroke="#E8DED0" strokeWidth="2" />
        <path d="M158 196 q-22 4 -30 16 M168 200 q-18 10 -22 22" stroke={C.skinShade} strokeWidth="12" fill="none" strokeLinecap="round" />
        <circle cx="270" cy="178" r="26" fill={C.skin} />
        <Face x={272} y={182} s={0.3} expression="asleep" />
      </g>
      <Pat x={196} y={140} rotate={0} />
      <path d="M306 230 l0 -50 m-8 10 l8 -10 l8 10" stroke={C.leaf} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function BurpAfter() {
  const loop = useLoop(3);
  return (
    <g>
      {/* Three small holds in a ring: if one does not work, move to the next. */}
      {[
        { x: 110, y: 110, label: "1" },
        { x: 290, y: 110, label: "2" },
        { x: 200, y: 230, label: "3" },
      ].map((h, i) => (
        <motion.g key={h.label} animate={{ opacity: [0.45, 1, 0.45] }} transition={{ ...loop, delay: i * 1 }}>
          <circle cx={h.x} cy={h.y} r="48" fill={C.paper} stroke={C.blanketEdge} strokeWidth="3" />
          <circle cx={h.x} cy={h.y - 10} r="14" fill={C.skin} />
          <rect x={h.x - 13} y={h.y + 4} width="26" height="28" rx="12" fill="#FFFFFF" stroke="#E8DED0" strokeWidth="2" />
          <text x={h.x + 30} y={h.y - 28} fontFamily="ui-monospace, monospace" fontSize="18" fill={C.ink}>
            {h.label}
          </text>
        </motion.g>
      ))}
      <path d="M170 100 Q200 80 230 100 M286 170 Q272 200 250 214 M150 214 Q128 200 114 170" stroke={C.slate} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="4 7" />
    </g>
  );
}

/* Safe sleep: a crib from the front, then the room. */

function Crib({ surface, clutter, baby }: { surface?: boolean; clutter?: boolean; baby?: boolean }) {
  const loop = useLoop(1.6);
  return (
    <g>
      <rect x="60" y="80" width="12" height="190" rx="5" fill={C.wood} />
      <rect x="328" y="80" width="12" height="190" rx="5" fill={C.wood} />
      <rect x="60" y="80" width="280" height="10" rx="5" fill={C.wood} />
      <motion.rect x="72" y="200" width="256" height="30" rx="4" fill={C.sheet} stroke="#C9D3D3" strokeWidth="2" initial={surface ? { scaleY: 1.8, y: -10 } : false} animate={{ scaleY: 1, y: 0 }} transition={enter} style={{ transformBox: "fill-box", originY: "100%" }} />
      <rect x="60" y="230" width="280" height="10" rx="5" fill={C.woodShade} />
      {[100, 140, 180, 220, 260, 300].map((x) => (
        <rect key={x} x={x} y="90" width="6" height="110" rx="3" fill={C.wood} opacity="0.55" />
      ))}
      {surface && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={enter}>
          {/* A level: the bubble settles in the middle. */}
          <rect x="150" y="176" width="100" height="18" rx="9" fill="#FFFFFF" stroke={C.leaf} strokeWidth="2.5" />
          <motion.circle cy="185" r="6" fill={C.leaf} initial={{ cx: 168 }} animate={{ cx: 200 }} transition={{ ...enter, duration: 1.1 }} />
          <line x1="190" x2="190" y1="178" y2="192" stroke={C.leaf} strokeWidth="1.5" />
          <line x1="210" x2="210" y1="178" y2="192" stroke={C.leaf} strokeWidth="1.5" />
        </motion.g>
      )}
      {clutter && (
        <g>
          {/* Pillow, blanket and toy lift out of the crib and fade. */}
          {[
            <ellipse key="p" cx="120" cy="186" rx="38" ry="16" fill="#FFFFFF" stroke="#D9CFC0" strokeWidth="2" />,
            <path key="b" d="M180 200 q30 -24 60 -6 q20 10 40 0 l0 6 l-100 0 Z" fill={C.blanket} stroke={C.blanketEdge} strokeWidth="2" />,
            <g key="t">
              <circle cx="292" cy="178" r="16" fill="#B89A7A" />
              <circle cx="280" cy="164" r="6" fill="#B89A7A" />
              <circle cx="304" cy="164" r="6" fill="#B89A7A" />
            </g>,
          ].map((item, i) => (
            <motion.g key={i} initial={{ y: 0, opacity: 1 }} animate={{ y: -150, opacity: 0 }} transition={{ duration: 0.9, ease: ease.out, delay: 0.5 + i * 0.25 }}>
              {item}
            </motion.g>
          ))}
          <motion.path d="M178 150 l16 16 l30 -34" stroke={C.leaf} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 1.6, ease: ease.out }} />
        </g>
      )}
      {baby && (
        <motion.g initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={enter}>
          {/* On the back, feet at the foot end (left). */}
          <rect x="96" y="178" width="110" height="26" rx="13" fill="#FFFFFF" stroke="#E8DED0" strokeWidth="2" />
          <circle cx="232" cy="180" r="24" fill={C.skin} />
          <Face x={232} y={184} s={0.28} expression="asleep" />
          <motion.path d="M96 160 l-20 0 m8 -8 l-8 8 l8 8" stroke={C.leaf} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" animate={{ x: [0, -6, 0] }} transition={loop} />
        </motion.g>
      )}
    </g>
  );
}

function Room() {
  const loop = useLoop(3);
  return (
    <g>
      <rect x="0" y="250" width="400" height="50" fill="#EFE6D8" />
      {/* Adult bed, and the crib pulled up beside it. */}
      <rect x="40" y="170" width="190" height="60" rx="10" fill={C.shirt} />
      <rect x="40" y="150" width="60" height="30" rx="12" fill="#FFFFFF" />
      <rect x="30" y="120" width="14" height="130" rx="5" fill={C.woodShade} />
      <rect x="40" y="226" width="190" height="24" rx="6" fill={C.woodShade} />
      <motion.g initial={{ x: 60 }} animate={{ x: 0 }} transition={enter}>
        <rect x="250" y="150" width="10" height="100" rx="4" fill={C.wood} />
        <rect x="350" y="150" width="10" height="100" rx="4" fill={C.wood} />
        <rect x="250" y="150" width="110" height="8" rx="4" fill={C.wood} />
        <rect x="260" y="204" width="90" height="16" rx="3" fill={C.sheet} />
        {[272, 292, 312, 332].map((x) => (
          <rect key={x} x={x} y="158" width="5" height="46" rx="2" fill={C.wood} opacity="0.55" />
        ))}
        <circle cx="330" cy="196" r="12" fill={C.skin} />
        <rect x="270" y="194" width="50" height="12" rx="6" fill="#FFFFFF" />
      </motion.g>
      <motion.g animate={{ opacity: [0.6, 1, 0.6] }} transition={loop}>
        <path d="M320 40 a34 34 0 1 0 30 50 a28 28 0 1 1 -30 -50 Z" fill="#F2D59A" />
      </motion.g>
    </g>
  );
}
