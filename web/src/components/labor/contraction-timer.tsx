"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, Phone, RotateCcw, Settings2, Undo2 } from "lucide-react";
import { checkRule, clock, LABOR_SOURCES, NICHD_RULE, pretermPattern, urgentPattern, withIntervals, type CallRule } from "@/lib/labor";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";
import { spring } from "@/components/joy/motion";
import { helpHref } from "@/components/shell/urgent-help-link";
import { RhythmBars } from "./rhythm-bars";
import { useContractions, useNow, useWakeLock } from "./use-contractions";

/** A session counts as "timing" while one is running or the last began under 20 minutes ago: keep the screen on. */
const ACTIVE_MS = 20 * 60_000;
const SHOWN = 6;

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * The contraction timer and its "when to call" card, as two grid cells. One big
 * target, Started then Ended, that a partner can hit one-handed; every number
 * is derived from the tapped timestamps. The call card compares the pattern
 * with one fixed rule (NICHD's, or the one the family's provider gave them),
 * and never says whether labor is "real".
 */
export function ContractionTimer({
  familyId,
  memberId,
  week,
  call,
}: {
  familyId: string;
  memberId: string;
  /** Week of pregnancy, for NICHD's before-37-weeks advice. */
  week?: number;
  /** The number the birth plan says to call in labor, when there is one. */
  call?: { name: string; phone: string };
}) {
  const { list, running, tap, undo, clear, loaded, rule, customRule, setRule } = useContractions(familyId);
  const last = list.at(-1);
  const now = useNow();
  useWakeLock(running || (last != null && now - last.start < ACTIVE_MS));

  const timed = withIntervals(list).reverse();
  const done = timed.filter((c) => c.duration != null);
  const lastDone = done[0];
  const inHour = list.filter((c) => now - c.start <= 60 * 60_000).length;

  return (
    <>
      <SoftCard tone="sun" hero as="section" aria-labelledby="timer-title" className="@4xl:col-span-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="timer-title" className="text-headline">
            Contraction timer
          </h2>
          <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Kept on this device only. Not a health record.
          </p>
        </div>

        <div className="mt-5 grid gap-6 @3xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:mt-7">
          <TapButton running={running} startedAt={running ? last!.start : undefined} now={now} onTap={tap} disabled={!loaded} />

          <div className="flex min-w-0 flex-col gap-5">
            <dl className="grid grid-cols-3 gap-3">
              <Figure label="Lasted" value={lastDone ? clock(lastDone.duration!) : "--"} />
              <Figure label="Apart" value={lastDone?.interval != null ? clock(lastDone.interval) : "--"} />
              <Figure label="Last hour" value={String(inHour)} />
            </dl>
            <RhythmBars list={list} now={now} />
          </div>
        </div>

        {timed.length > 0 ? (
          <div className="mt-6">
            <div className="grid grid-cols-[1fr_1fr_1fr] px-3 font-mono text-caption text-muted-foreground uppercase">
              <span>Started</span>
              <span className="text-right">Lasted</span>
              <span className="text-right">Apart</span>
            </div>
            <ul className="mt-1 flex flex-col gap-1">
              <AnimatePresence initial={false}>
                {timed.slice(0, SHOWN).map((c) => (
                  <motion.li
                    key={c.start}
                    layout="position"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={spring.ui}
                    className="grid grid-cols-[1fr_1fr_1fr] items-center rounded-2xl bg-card/70 px-3 py-2 font-mono text-label"
                  >
                    <span>{timeOf(c.start)}</span>
                    <span className="text-right">{c.duration != null ? clock(c.duration) : <span className="text-me">{clock(now - c.start)}</span>}</span>
                    <span className="text-right text-ink-2">{c.interval != null ? clock(c.interval) : "first"}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {timed.length > SHOWN && <span className="mr-auto text-caption text-muted-foreground">and {timed.length - SHOWN} earlier today</span>}
              <button type="button" onClick={undo} className="press ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-label text-ink-2 outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50">
                <Undo2 className="size-4" aria-hidden />
                Undo last tap
              </button>
              <ClearButton onClear={clear} />
            </div>
          </div>
        ) : (
          <p className="mt-6 max-w-prose text-label font-normal text-ink-2">
            Practice once now: tap Started, count a slow breath or two, tap Ended. On the day, whoever is free taps; the rhythm builds up here.
          </p>
        )}
      </SoftCard>

      <CallCard list={list} now={now} week={week} rule={rule} customRule={customRule} setRule={setRule} call={call} memberId={memberId} />
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card/70 px-3 py-2.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="font-mono text-title tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Started / Ended. The two faces crossfade (opacity only) and the press scales,
 * both as transitions, so a fast double tap retargets instead of restarting.
 */
function TapButton({ running, startedAt, now, onTap, disabled }: { running: boolean; startedAt?: number; now: number; onTap: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-live="polite"
      className="press relative grid min-h-44 w-full place-items-center overflow-hidden rounded-[1.75rem] text-center outline-none focus-visible:ring-4 focus-visible:ring-ring/50 md:min-h-56"
    >
      <span aria-hidden className={cn("absolute inset-0 bg-me transition-opacity duration-(--duration-base) ease-(--ease-out)", running && "opacity-0")} />
      <span aria-hidden className={cn("absolute inset-0 border-4 border-me bg-card transition-opacity duration-(--duration-base) ease-(--ease-out) rounded-[1.75rem]", !running && "opacity-0")} />
      <span className={cn("relative col-start-1 row-start-1 flex flex-col items-center gap-1 text-primary-foreground transition-opacity duration-(--duration-base) ease-(--ease-out)", running && "opacity-0")} aria-hidden={running}>
        <span className="text-display">Started</span>
        <span className="text-label font-normal opacity-85">Tap as a contraction begins</span>
      </span>
      <span className={cn("relative col-start-1 row-start-1 flex flex-col items-center gap-1 text-me transition-opacity duration-(--duration-base) ease-(--ease-out)", !running && "opacity-0")} aria-hidden={!running}>
        <span className="font-mono text-display tabular-nums">{startedAt != null ? clock(now - startedAt) : "0:00"}</span>
        <span className="text-title">Ended</span>
        <span className="text-label font-normal text-ink-2">Tap when it eases off</span>
      </span>
      <span className="sr-only">{running ? "Contraction running. Tap when it ends." : "Tap when a contraction starts."}</span>
    </button>
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  const [sure, setSure] = useState(false);
  return (
    <button
      type="button"
      onClick={() => (sure ? (onClear(), setSure(false)) : setSure(true))}
      onBlur={() => setSure(false)}
      className={cn(
        "press inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        sure ? "bg-ink text-paper" : "text-ink-2 hover:bg-card",
      )}
    >
      <RotateCcw className="size-4" aria-hidden />
      {sure ? "Tap again to clear all" : "Clear"}
    </button>
  );
}

const minutes = (n: number) => `${n} min`;
const ruleWords = (r: CallRule) =>
  `Every ${minutes(r.everyMin)} or closer, for ${r.forMin >= 60 && r.forMin % 60 === 0 ? `${r.forMin / 60} hour${r.forMin > 60 ? "s" : ""}` : minutes(r.forMin)}${r.lastsSec ? `, each lasting ${r.lastsSec} s` : ""}`;

/**
 * When to call. Fixed text only: the rule (NICHD's, or the provider's own), how
 * far the current pattern is along it, and the sourced reasons to call sooner.
 * Calm tones throughout; red is only the link to the fixed Urgent help screen.
 */
function CallCard({
  list,
  now,
  week,
  rule,
  customRule,
  setRule,
  call,
  memberId,
}: {
  list: ReturnType<typeof useContractions>["list"];
  now: number;
  week?: number;
  rule: CallRule;
  customRule: boolean;
  setRule: (r: CallRule | null) => void;
  call?: { name: string; phone: string };
  memberId: string;
}) {
  const [editing, setEditing] = useState(false);
  const check = checkRule(list, rule, now);
  const preterm = pretermPattern(list, week, now);
  const urgent = urgentPattern(list, now);
  const callNow = check.matches || preterm;
  const progress = Math.min(check.runMin / rule.forMin, 1);

  return (
    <SoftCard as="section" tone={callNow ? "leaf" : "plain"} aria-labelledby="call-title" className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-caption tracking-wide text-muted-foreground uppercase">When to call</p>
        <h2 id="call-title" className="mt-1 text-title" aria-live="polite">
          {callNow ? "Time to call your provider" : check.count >= 2 ? "Not yet at your rule" : "Your rule to call"}
        </h2>
        {preterm ? (
          <p className="mt-2 text-body">
            Before week 37, NICHD says regular contractions are a reason to call your provider or go to the hospital now, without waiting an hour.
          </p>
        ) : callNow ? (
          <p className="mt-2 text-body">The pattern you timed matches the rule below. Call and tell them what you timed.</p>
        ) : null}
      </div>

      {callNow && call && (
        <a
          href={`tel:${call.phone.replace(/[^\d+]/g, "")}`}
          className="press flex min-h-14 items-center gap-3 rounded-2xl bg-leaf px-4 text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Phone className="size-5" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-label font-semibold">Call {call.name}</span>
          <span className="font-mono text-label">{call.phone}</span>
        </a>
      )}

      <div className="rounded-2xl bg-muted/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-label">
            <span className="block text-caption font-normal text-muted-foreground">{customRule ? "Your provider's rule" : "NICHD's rule"}</span>
            {ruleWords(rule)}
          </p>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
            className="press -mt-1 -mr-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-label text-primary outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Settings2 className="size-4" aria-hidden />
            {editing ? "Done" : "Change"}
          </button>
        </div>
        {editing && <RuleEditor rule={rule} customRule={customRule} setRule={setRule} />}
        {/* How far the current run is along the rule's hour. */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-card" aria-hidden>
          <div className="h-full origin-left rounded-full bg-leaf transition-transform duration-(--duration-slow) ease-(--ease-out)" style={{ transform: `scaleX(${check.count >= 2 ? progress : 0})` }} />
        </div>
        <p className="mt-1.5 font-mono text-caption text-muted-foreground">
          {check.count >= 2 ? `${check.count} in a row · ${Math.floor(check.runMin)} of ${rule.forMin} min` : "Starts counting from the first close pair"}
        </p>
        <SourceLine className="mt-2" sources={[LABOR_SOURCES.nichdStart]} />
      </div>

      <p className="text-label font-normal text-ink-2">Your care team&apos;s instructions come first. Call any time you are worried, whatever the timer shows.</p>

      {/* Fixed text from the cited pages; the link is the fixed Urgent help screen. Never animated. */}
      <div className={cn("rounded-2xl border-2 p-4", urgent ? "border-urgent" : "border-line")}>
        {urgent && (
          <p className="mb-3 text-label font-semibold text-urgent">
            NHS says to call your maternity unit straight away if a contraction lasts longer than 2 minutes or you have 6 or more in 10 minutes.
          </p>
        )}
        <p className="text-label font-semibold">Call now, don&apos;t wait for the timer, if there is</p>
        <ul className="mt-2 grid gap-1.5 text-label font-normal text-ink-2">
          <li>Bleeding, or fluid leaking</li>
          <li>Waters that are coloured or smell</li>
          <li>The baby moving less than usual</li>
          <li>Severe belly pain that does not go away</li>
          <li>A fever of 100.4°F (38°C) or higher</li>
        </ul>
        <a
          href={helpHref(memberId)}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-urgent px-4 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-urgent/40"
        >
          <span aria-hidden className="size-1.75 rounded-full bg-white" />
          Open Urgent help
        </a>
        <SourceLine className="mt-3" sources={[LABOR_SOURCES.cdcHearHer, LABOR_SOURCES.nhsSigns]} />
      </div>
    </SoftCard>
  );
}

function Stepper({ label, value, unit, min, max, step, onChange }: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (n: number) => void }) {
  const btn = "press grid size-11 place-items-center rounded-full bg-card text-title outline-none disabled:opacity-40 focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-label font-normal">{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label={`Less: ${label}`}>
          −
        </button>
        <output className="w-16 text-center font-mono text-label">
          {value} {unit}
        </output>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label={`More: ${label}`}>
          +
        </button>
      </span>
    </div>
  );
}

function RuleEditor({ rule, customRule, setRule }: { rule: CallRule; customRule: boolean; setRule: (r: CallRule | null) => void }) {
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-caption text-muted-foreground">Set the rule your midwife or OB gave you. It stays on this device.</p>
      <Stepper label="Apart, at most" value={rule.everyMin} unit="min" min={2} max={15} step={1} onChange={(everyMin) => setRule({ ...rule, everyMin })} />
      <Stepper label="For at least" value={rule.forMin} unit="min" min={15} max={120} step={15} onChange={(forMin) => setRule({ ...rule, forMin })} />
      <Stepper label="Each lasting" value={rule.lastsSec ?? 0} unit="s" min={0} max={90} step={15} onChange={(s) => setRule({ ...rule, lastsSec: s || undefined })} />
      {customRule && (
        <button type="button" onClick={() => setRule(null)} className="press mt-1 inline-flex min-h-11 items-center self-start rounded-full px-3 text-label text-primary outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50">
          Use NICHD&apos;s rule again ({ruleWords(NICHD_RULE).toLowerCase()})
        </button>
      )}
    </div>
  );
}
