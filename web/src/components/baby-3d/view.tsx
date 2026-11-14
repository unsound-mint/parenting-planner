"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PregnancyGrowth, PregnancyGrowthWeek } from "@/lib/api/types";
import { SizeIllustration } from "@/components/illustrations";
import { cn } from "@/lib/utils";
import { AREA_ICON, AREA_LABEL } from "./areas";
import "./baby-3d.css";

// The 3D view: the canvas, the week scrubber and the week's facts as text.
// three.js loads only here, in its own chunk, after the page has painted.
const BabyScene = dynamic(() => import("./scene"), { ssr: false, loading: () => null });

const MIN = 4;
const MAX = 40;
const TRIMESTERS = [
  { label: "1st", from: 4, to: 12 },
  { label: "2nd", from: 13, to: 27 },
  { label: "3rd", from: 28, to: 40 },
];

export function Baby3DView({ growth, initialWeek }: { growth: PregnancyGrowth; initialWeek: number }) {
  const byWeek = useMemo(() => new Map(growth.weeks.map((w) => [w.week, w])), [growth.weeks]);
  const [week, setWeek] = useState(() => clamp(initialWeek));
  const [selected, setSelected] = useState<number | null>(null);
  const reduced = useReducedMotion() ?? false;
  const data = nearest(byWeek, week);
  const stage = useRef<HTMLDivElement>(null);
  const paused = usePaused(stage);
  const listId = useId();

  const go = useCallback((w: number) => {
    setWeek(clamp(w));
    setSelected(null);
  }, []);

  // Keep the address in step, so a reload or a shared link opens the same week.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("week", String(week));
    window.history.replaceState(window.history.state, "", url);
  }, [week]);

  const select = useCallback((i: number | null) => {
    setSelected(i);
    if (i != null) document.getElementById(`${listId}-${i}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [listId]);

  const size = data.size;
  const heel = size.lengthMeasure === "crown-heel";
  const comparison = size.comparison.replace(/^(a|an) /, "");
  const sources = uniqueSources(data);

  return (
    <>
    <h1 className="text-headline text-balance">
      Week {data.week}: about the size of <span className="text-[#A04828]">{size.comparison}</span>
    </h1>
    <div className="grid min-w-0 gap-6 @5xl:grid-cols-[minmax(0,1fr)_minmax(320px,26rem)] @7xl:grid-cols-[minmax(0,1fr)_28rem]">
      <section aria-label="Your baby in 3D" className="flex min-w-0 flex-col gap-4">
        <div
          ref={stage}
          className="relative isolate h-[min(64vh,760px)] min-h-[340px] overflow-hidden rounded-3xl max-sm:h-[380px]"
          style={{ background: "radial-gradient(120% 90% at 50% 38%, #FFF8EE 0%, #FCEBD5 52%, #F8DDB8 100%)" }}
        >
          {/* The canvas is decoration for screen readers; the same facts are in the list. */}
          <div aria-hidden className="absolute inset-0">
            <Fallback comparison={size.comparison} week={week}>
              <BabyScene
                week={data.week}
                lengthCm={size.lengthCm}
                lengthMeasure={size.lengthMeasure}
                areas={data.hotspots.map((h) => h.area)}
                selected={selected}
                onSelect={select}
                reducedMotion={reduced}
                paused={paused}
              />
            </Fallback>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 flex items-end gap-3 sm:bottom-6 sm:left-6">
            <div className="size-16 shrink-0 sm:size-20">
              <SizeIllustration comparison={size.comparison} week={data.week} interactive={false} seed="baby-3d" />
            </div>
            <div className="pb-1">
              <p className="font-mono text-title tabular-nums">
                <NumberFlow value={size.lengthCm} format={{ maximumFractionDigits: 1 }} suffix=" cm" />
              </p>
              <p className="text-label text-muted-foreground">
                {heel ? "head to heel" : size.lengthMeasure === "crown-rump" ? "head to bottom" : "long"}
              </p>
            </div>
          </div>
          <p className="pointer-events-none absolute top-4 right-4 hidden rounded-full bg-card/80 px-3 py-1 text-caption text-muted-foreground sm:block">
            Drag to turn. Tap a glowing dot.
          </p>
        </div>

        <Scrubber week={week} current={growth.currentWeek} onChange={go} comparison={comparison} />
        <p className="sr-only" aria-live="polite">
          {`Week ${data.week}. About ${size.lengthCm} cm ${heel ? "head to heel" : "long"}, about the size of ${size.comparison}. ${data.hotspots.length} new ${data.hotspots.length === 1 ? "thing" : "things"} this week, listed below.`}
        </p>
      </section>

      <section aria-labelledby={`${listId}-title`} className="flex min-w-0 flex-col gap-4 @5xl:pt-2">
        <h2 id={`${listId}-title`} className="text-title">
          New in week {data.week}
        </h2>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.ol
            key={data.week}
            className="flex flex-col gap-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {data.hotspots.map((h, i) => {
              const Icon = AREA_ICON[h.area];
              const on = selected === i;
              return (
                <li key={i} id={`${listId}-${i}`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected(on ? null : i)}
                    className={cn(
                      "flex min-h-11 w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99]",
                      on ? "border-[#E8A07C] bg-[#FAE3D5]" : "border-border bg-card hover:border-[#E3D6C2]",
                    )}
                  >
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", on ? "bg-[#A04828] text-white" : "bg-[#FCEBD5] text-[#A04828]")}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-caption font-medium tracking-wide text-muted-foreground">{AREA_LABEL[h.area]}</span>
                      <span className="block text-body text-pretty">{h.text}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ol>
        </AnimatePresence>
        <p className="font-mono text-caption text-muted-foreground">
          {sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                {s.title.replace(/, week-by-week guide to pregnancy$/, "")}
              </a>
            </span>
          ))}
          {sources[0] && ` · checked ${sources[0].checkedAt}`}
        </p>
        <p className="text-caption text-muted-foreground">Every baby grows at their own pace. The model is a friendly picture, not a scan.</p>
      </section>
    </div>
    </>
  );
}

function Scrubber({ week, current, onChange, comparison }: { week: number; current: number; onChange: (w: number) => void; comparison: string }) {
  const pct = (w: number) => ((w - MIN) / (MAX - MIN)) * 100;
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <StepButton label="Previous week" disabled={week <= MIN} onClick={() => onChange(week - 1)}>
        <ChevronLeft className="size-5" aria-hidden />
      </StepButton>
      <div className="relative min-w-0 flex-1 pt-7 pb-6">
        <p className="absolute top-0 text-label font-semibold tabular-nums" style={{ left: `clamp(0px, calc(${pct(week)}% - 2.25rem), calc(100% - 4.5rem))` }}>
          <span className="inline-block w-18 text-center">Week {week}</span>
        </p>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={week}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Pregnancy week"
          aria-valuetext={`Week ${week}, about the size of ${comparison}`}
          className="pp-week-range relative z-10 block w-full"
          style={{ "--pct": `${pct(week)}%` } as React.CSSProperties}
        />
        {/* Week ticks and the trimesters under the track. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-[9px] top-[2.6rem] h-2">
          {Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i).map((w) => (
            <span
              key={w}
              className={cn("absolute top-0 w-px -translate-x-1/2", w % 4 === 0 ? "h-2 bg-[#C9B79E]" : "h-1 bg-[#E3D6C2]")}
              style={{ left: `${pct(w)}%` }}
            />
          ))}
          <span className="absolute -top-[1.05rem] size-2 -translate-x-1/2 rounded-full bg-[#A04828]" style={{ left: `${pct(current)}%` }} />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-[9px] bottom-0 flex text-caption text-muted-foreground">
          {TRIMESTERS.map((t) => (
            <span key={t.label} className="truncate" style={{ width: `${((t.to - t.from + (t.from === MIN ? 0 : 1)) / (MAX - MIN)) * 100}%` }}>
              {t.label}
              {t.from === MIN && <span className="max-sm:hidden"> trimester</span>}
            </span>
          ))}
        </div>
      </div>
      <StepButton label="Next week" disabled={week >= MAX} onClick={() => onChange(week + 1)}>
        <ChevronRight className="size-5" aria-hidden />
      </StepButton>
      <button
        type="button"
        onClick={() => onChange(current)}
        disabled={week === current}
        className="hidden h-11 shrink-0 items-center rounded-full border border-border bg-card px-4 text-label transition-[opacity,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 sm:inline-flex"
      >
        Now, week {current}
      </button>
    </div>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-[opacity,transform] duration-150 ease-out hover:border-[#E3D6C2] active:scale-[0.94] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Pause rendering while the canvas is off screen or the tab is hidden. */
function usePaused(ref: React.RefObject<HTMLElement | null>) {
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    const vis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [ref]);
  return offscreen || hidden;
}

/** Without WebGL the fruit picture stays in place of the model. */
class Fallback extends Component<{ comparison: string; week: number; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="size-56">
          <SizeIllustration comparison={this.props.comparison} week={this.props.week} interactive={false} />
        </div>
      </div>
    );
  }
}

function clamp(w: number) {
  return Math.min(MAX, Math.max(MIN, Math.round(w)));
}

function nearest(byWeek: Map<number, PregnancyGrowthWeek>, week: number): PregnancyGrowthWeek {
  for (let d = 0; d <= MAX - MIN; d++) {
    const w = byWeek.get(week - d) ?? byWeek.get(week + d);
    if (w) return w;
  }
  throw new Error("no growth weeks");
}

function uniqueSources(w: PregnancyGrowthWeek) {
  const seen = new Map<string, { title: string; url: string; checkedAt: string }>();
  for (const s of [...w.hotspots.flatMap((h) => h.sources), ...w.size.sources]) if (!seen.has(s.url)) seen.set(s.url, s);
  return [...seen.values()];
}
