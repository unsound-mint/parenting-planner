"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { HeartHandshake, Pause, Play, Vibrate } from "lucide-react";
import { LABOR_SOURCES } from "@/lib/labor";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";

// Guided breathing, the signature motion of this page. One clock drives
// everything: the elapsed time since Start picks the phase, and each phase sets
// one CSS transition on the blob (transform only) that lasts exactly that
// phase. The label, the count and the haptic tick change at the same boundary,
// so they cannot drift apart. Pausing sets a short ease-out transition back to
// rest, which retargets from wherever the blob is, mid-breath or not.
//
// Breathing phases are the deliberate exception to the 150 to 400 ms UI rule:
// the motion is the instruction, so it takes as long as the breath.
// Under reduced motion the blob stays still and the count carries the rhythm.

type Phase = { label: string; ms: number; /** Blob scale at the end of the phase. */ to: number };

type Pattern = {
  id: "slow" | "light";
  name: string;
  when: string;
  how: string;
  /** One round; it repeats until paused. */
  round: Phase[];
};

// Counts are a comfortable pace to start from, not a rule: Lothian (2011) says
// there are no rules about breaths per minute. Shapes follow EOHU's
// slow-paced breathing and shallow "ha" breathing with cleansing breaths.
const PATTERNS: Pattern[] = [
  {
    id: "slow",
    name: "Slow breathing",
    when: "Early labor, and whenever it helps",
    how: "In through the nose, out through the mouth, slower than usual. Let your shoulders drop on every breath out.",
    round: [
      { label: "Breathe in", ms: 4000, to: 1 },
      { label: "Breathe out", ms: 6000, to: 0.62 },
    ],
  },
  {
    id: "light",
    name: "Light breathing",
    when: "When contractions are strong",
    how: "A deep cleansing breath, then quick, light breaths through the mouth, a soft “ha” on each one out. End with a cleansing breath. Too fast too early can make you dizzy: slow down if it does.",
    round: [
      { label: "Deep breath in", ms: 4000, to: 1 },
      { label: "Let it go", ms: 4000, to: 0.62 },
      ...Array.from({ length: 6 }, (): Phase[] => [
        { label: "In", ms: 900, to: 0.8 },
        { label: "Ha", ms: 900, to: 0.7 },
      ]).flat(),
      { label: "Deep breath in", ms: 4000, to: 1 },
      { label: "And out", ms: 5000, to: 0.62 },
    ],
  },
];

const REST = 0.62;
/** easeInOutSine (easings.net): breathing speeds up and slows down like a lung, not like a UI curve. */
const BREATH_EASE = "cubic-bezier(0.37, 0, 0.63, 1)";

type Cues = { title: string; body: string }[];

function partnerCues(name: string): Cues {
  return [
    { title: `Breathe with ${name}`, body: "Slow and a little audible, so she can follow your rhythm. The NHS suggests partners do the breathing too." },
    { title: "Hands on, if she wants it", body: "Massage her lower back or shoulders, as firm as she asks for. Ask, then follow her lead." },
    { title: "Stay, and say it", body: "“You’re doing it. This one is passing.” Being there the whole time is the support the evidence backs." },
  ];
}

export function BreathingGuide({ birthParent, isBirthParent, week }: { birthParent: string; isBirthParent: boolean; week?: number }) {
  const reduce = useReducedMotion();
  const [patternId, setPatternId] = useState<Pattern["id"]>("slow");
  const [playing, setPlaying] = useState(false);
  const [partner, setPartner] = useState(!isBirthParent);
  const [haptics, setHaptics] = useState(false);
  const [canVibrate, setCanVibrate] = useState(false);
  const [phase, setPhase] = useState<{ i: number; left: number; round: number } | null>(null);
  const blob = useRef<HTMLDivElement>(null);
  // Read inside the clock without restarting the breath when they change.
  const hapticsRef = useRef(haptics);
  const reduceRef = useRef(reduce);
  useEffect(() => {
    hapticsRef.current = haptics;
    reduceRef.current = reduce;
  }, [haptics, reduce]);
  const pattern = PATTERNS.find((p) => p.id === patternId)!;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator is only known after mount
    setCanVibrate(typeof navigator !== "undefined" && "vibrate" in navigator);
  }, []);

  // The clock. Starts on play, stops on pause, on a pattern change and when the tab hides.
  useEffect(() => {
    if (!playing) return;
    const round = pattern.round;
    const total = round.reduce((s, p) => s + p.ms, 0);
    const t0 = performance.now();
    const node = blob.current;
    let raf = 0;
    let lastKey = "";
    const tick = () => {
      const elapsed = performance.now() - t0;
      const n = Math.floor(elapsed / total);
      let t = elapsed - n * total;
      let i = 0;
      while (t >= round[i].ms) t -= round[i++].ms;
      const left = Math.ceil((round[i].ms - t) / 1000);
      const key = `${n}:${i}:${left}`;
      if (key !== lastKey) {
        const newPhase = !lastKey.startsWith(`${n}:${i}:`);
        lastKey = key;
        setPhase({ i, left, round: n });
        if (newPhase) {
          const el = node;
          // Reduced motion: the blob stays at rest and the count carries the rhythm.
          if (el && !reduceRef.current) {
            el.style.transition = `transform ${round[i].ms - t}ms ${BREATH_EASE}`;
            el.style.transform = `scale(${round[i].to})`;
          }
          if (hapticsRef.current && round[i].ms >= 2000) navigator.vibrate?.(round[i].to > REST ? 24 : [12, 60, 12]);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onHide = () => document.visibilityState === "hidden" && setPlaying(false);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
      // Back to rest from wherever the breath was: a short ease-out, interruptible like any transition.
      if (node) {
        node.style.transition = "transform var(--duration-slow) var(--ease-out)";
        node.style.transform = `scale(${REST})`;
      }
      setPhase(null);
    };
  }, [playing, pattern]);

  const current = phase ? pattern.round[phase.i] : undefined;
  const cues = partnerCues(birthParent);
  const cue = cues[(phase?.round ?? 0) % cues.length];
  const toWeek36 = week != null && week < 36 ? 36 - week : 0;

  return (
    <SoftCard as="section" aria-labelledby="breathe-title" className="rise @4xl:col-span-2" style={{ "--i": 3 } as React.CSSProperties}>
      <div className="grid gap-8 @3xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* The stage: a soft blob with the illustrations' face, sleeping eyes. */}
        <div className="flex flex-col items-center">
          <div className="relative grid aspect-square w-full max-w-80 place-items-center">
            <div aria-hidden className="absolute inset-[4%] rounded-full border-2 border-dashed border-line-2" />
            <div aria-hidden className="absolute inset-[19%] rounded-full bg-sun/60" />
            <div ref={blob} className="relative size-[86%] will-change-transform" style={{ transform: `scale(${REST})` }} aria-hidden>
              <BreathBlob />
            </div>
          </div>
          <p className={cn("mt-2 text-headline transition-opacity duration-(--duration-base)", !current && "text-muted-foreground")} aria-live="polite">
            {current ? current.label : "Ready when you are"}
          </p>
          <p className="h-9 font-mono text-title text-muted-foreground tabular-nums motion-reduce:text-headline motion-reduce:text-me" aria-hidden>
            {phase ? phase.left : ""}
          </p>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="press mt-2 inline-flex min-h-13 items-center gap-2 rounded-full bg-me px-7 text-label font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {playing ? <Pause className="size-4.5" aria-hidden /> : <Play className="size-4.5" aria-hidden />}
            {playing ? "Pause" : partner ? `Start, together with ${birthParent}` : "Start breathing"}
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="font-mono text-caption tracking-wide text-muted-foreground uppercase">Breathe through it</p>
            <h2 id="breathe-title" className="mt-1 text-headline text-balance">
              Two ways to breathe, practised before the day
            </h2>
          </div>

          <div role="radiogroup" aria-label="Breathing pattern" className="grid grid-cols-2 gap-2">
            {PATTERNS.map((p) => {
              const on = p.id === patternId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setPlaying(false);
                    setPatternId(p.id);
                  }}
                  className={cn(
                    "press flex min-h-11 flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    on ? "border-me bg-me-soft" : "border-line hover:bg-muted",
                  )}
                >
                  <Wave kind={p.id} className={on ? "text-me" : "text-muted-foreground"} />
                  <span className="text-label font-semibold">{p.name}</span>
                  <span className="text-caption text-muted-foreground">{p.when}</span>
                </button>
              );
            })}
          </div>

          <p className="max-w-prose text-body text-ink-2">{pattern.how}</p>

          <div className="flex flex-wrap gap-2">
            <Toggle on={partner} onClick={() => setPartner((v) => !v)} icon={HeartHandshake}>
              Partner mode
            </Toggle>
            {canVibrate && (
              <Toggle on={haptics} onClick={() => setHaptics((v) => !v)} icon={Vibrate}>
                Gentle buzz on each breath
              </Toggle>
            )}
          </div>

          {partner && (
            <div className="rounded-2xl bg-them-soft p-4">
              <p className="text-caption text-muted-foreground">For the support person{playing ? ", changes every round" : ""}</p>
              <p className="mt-1 text-title">{cue.title}</p>
              <p className="mt-1 text-label font-normal text-ink-2">{cue.body}</p>
              {!playing && (
                <ul className="mt-3 grid gap-1 text-label font-normal text-ink-2">
                  {cues.slice(1).map((c) => (
                    <li key={c.title}>· {c.title}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="rounded-2xl bg-leaf-soft p-4 text-label font-normal text-ink-2">
            <span className="font-semibold text-leaf">Practise together. </span>
            {toWeek36 > 0
              ? `A round tonight, then a few minutes most evenings from week 36, ${toWeek36} weeks from now. On the day it is already familiar.`
              : "A few minutes most evenings, so on the day it is already familiar."}
          </p>

          <p className="text-caption text-muted-foreground">
            What the evidence says: Cochrane reviews found that relaxation, massage and continuous support from someone you trust may ease labor pain or help the birth go well. The reviews rate the evidence as low quality, so use what helps you.
          </p>
          <SourceLine
            sources={[
              LABOR_SOURCES.eohuBreathing,
              LABOR_SOURCES.lothian,
              LABOR_SOURCES.nhsSigns,
              LABOR_SOURCES.cochraneRelax,
              LABOR_SOURCES.cochraneMassage,
              LABOR_SOURCES.cochraneSupport,
            ]}
          />
        </div>
      </div>
    </SoftCard>
  );
}

function Toggle({ on, onClick, icon: Icon, children }: { on: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "press inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        on ? "border-them bg-them-soft text-them" : "border-line text-ink-2 hover:bg-muted",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  );
}

/** A long slow wave or a run of short light ones: the two patterns as pictures. */
function Wave({ kind, className }: { kind: Pattern["id"]; className?: string }) {
  const d =
    kind === "slow"
      ? "M2 14 C 14 2, 26 2, 38 14 S 62 26, 74 14"
      : "M2 14 C 6 2, 10 2, 14 14 S 22 26, 26 14 S 34 2, 38 14 S 46 26, 50 14 S 58 2, 62 14 S 70 26, 74 14";
  return (
    <svg viewBox="0 0 76 28" className={cn("h-5 w-14", className)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** The breathing blob: the app's warm apricot blob with the illustrations' calm, closed-eye face. */
function BreathBlob() {
  return (
    <svg viewBox="0 0 200 200" className="size-full">
      <path d="M100 12c35 0 66 18 79 46s10 66-9 91-53 39-85 36-56-18-71-45S4 75 22 47 65 12 100 12z" fill="#F7CB92" />
      <path d="M100 30c27 0 51 13 61 34" stroke="#FCEBD5" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".7" />
      <circle cx="62" cy="112" r="11" fill="#F3B08A" opacity=".7" />
      <circle cx="138" cy="112" r="11" fill="#F3B08A" opacity=".7" />
      <path d="M72 96c5 5 12 5 17 0M111 96c5 5 12 5 17 0" stroke="#2B2620" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M92 118c5 5 11 5 16 0" stroke="#2B2620" strokeWidth="3.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
