"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BellOff, Check, FastForward, Flag, Lightbulb, Pause, Play } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Parent, VirtualBaby, VirtualBabyMode, VirtualBabyMoment, VirtualBabySession, VirtualBabySticker } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ease, spring } from "@/components/joy/motion";
import { Avatar } from "@/components/joy/partner-chip";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";
import { VirtualBabyFigure, type Reaction } from "./baby";
import {
  activeSession,
  clockAt,
  dayAt,
  formatClock,
  isNight,
  modeInfo,
  needExpression,
  needIcon,
  needLabel,
  needLevel,
  needTopic,
  reachedMinute,
  SIM_MINUTES_PER_SECOND,
} from "./model";
import { StickerShelf } from "./stickers";

const BTN = "press inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4.5 text-label font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

type Props = { memberId: string; parents: Parent[]; initial: VirtualBaby };

/**
 * The Virtual Baby screen. One family session at a time: the simulated clock
 * runs here, in this tab, only while it is visible and not paused, and stops
 * whenever the baby is waiting on someone. Answers are stored through the API
 * with the parent who took the turn; feedback and sources come from the API.
 */
export function VirtualBabyScreen({ memberId, parents, initial }: Props) {
  const [data, setData] = useState(initial);
  const active = activeSession(data.items);
  const [summary, setSummary] = useState<{ session: VirtualBabySession; fresh: VirtualBabySticker["id"][] }>();
  const [pending, startTransition] = useTransition();

  const me = parents.find((p) => p.id === memberId) ?? parents[0];
  const them = parents.find((p) => p.id !== memberId);

  const replace = useCallback((s: VirtualBabySession) => setData((d) => ({ ...d, items: [s, ...d.items.filter((x) => x.id !== s.id)] })), []);

  const reload = useCallback(async () => {
    const { data: fresh } = await api.GET("/members/{memberId}/virtual-baby", { params: { path: { memberId } } });
    if (fresh) setData(fresh);
    return fresh;
  }, [memberId]);

  function start(mode: VirtualBabyMode) {
    startTransition(async () => {
      const { data: s, response } = await api.POST("/members/{memberId}/virtual-baby-sessions", { params: { path: { memberId } }, body: { mode } });
      if (s) {
        setSummary(undefined);
        replace(s);
      } else if (response.status === 409) {
        await reload();
        toast("A session is already running. Picking it up where you left off.");
      } else toast.error("Could not start the session. Please try again.");
    });
  }

  async function finished(s: VirtualBabySession) {
    const before = new Set(data.stickers.map((x) => x.id));
    const fresh = await reload();
    setSummary({ session: s, fresh: (fresh?.stickers ?? []).filter((x) => !before.has(x.id)).map((x) => x.id) });
  }

  const last = data.items.find((s) => s.finishedAt);

  return (
    <div className="grid min-w-0 items-start gap-6 @5xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      {active ? (
        <Player key={active.id} memberId={memberId} parents={parents} me={me} them={them} session={active} onUpdate={replace} onFinished={finished} onReload={reload} />
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          {summary ? (
            <Summary session={summary.session} parents={parents} memberId={memberId} justNow onAgain={() => setSummary(undefined)} />
          ) : (
            <StartHero onStart={start} busy={pending} them={them} />
          )}
        </div>
      )}

      <aside className="flex min-w-0 flex-col gap-6">
        {active ? (
          <SessionLog session={active} parents={parents} memberId={memberId} />
        ) : (
          !summary && last && <Summary session={last} parents={parents} memberId={memberId} />
        )}
        <SoftCard as="section" aria-labelledby="vb-stickers" className="@container">
          <h2 id="vb-stickers" className="text-title">
            Stickers
          </h2>
          <p className="mt-1 text-label font-normal text-muted-foreground">For taking part, together. Not for getting it right.</p>
          <div className="mt-5">
            <StickerShelf stickers={data.stickers} parents={parents} fresh={summary?.fresh} />
          </div>
        </SoftCard>
        <Honest />
      </aside>
    </div>
  );
}

/** The plain disclaimer the challenge must carry. */
function Honest() {
  return (
    <SoftCard tone="leaf" className="flex gap-3">
      <BellOff className="mt-0.5 size-5 shrink-0 text-leaf" aria-hidden />
      <div className="text-label font-normal text-ink-2">
        <p>
          <span className="font-semibold text-ink">Practice, not prediction.</span> A real baby will not follow this script. This one is simplified on purpose, so you can
          rehearse the decisions, not the exhaustion.
        </p>
        <p className="mt-2">The clock only runs while this page is open. No notifications, no 2 am alarms.</p>
      </div>
    </SoftCard>
  );
}

function StartHero({ onStart, busy, them }: { onStart: (m: VirtualBabyMode) => void; busy: boolean; them?: Parent }) {
  return (
    <SoftCard tone="sun" hero as="section" aria-labelledby="vb-title" className="flex flex-col gap-6 @container">
      <div className="grid items-center gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="mx-auto w-full max-w-72">
          <VirtualBabyFigure expression="asleep" label="The virtual baby, asleep. Tap to say hello." />
        </div>
        <div className="min-w-0">
          <p className="text-caption font-semibold tracking-wider text-ink-2 uppercase">Virtual Baby</p>
          <h1 id="vb-title" className="mt-2 text-display text-balance">
            Practise the <em className="text-me">first nights</em> before they are real
          </h1>
          <p className="mt-3 max-w-prose text-body text-ink-2">
            Feed, change, settle and soothe a simulated newborn. Every choice gets a kind answer with its source{them ? `, and you and ${them.displayName} take turns` : ""}.
          </p>
        </div>
      </div>
      <div className="grid gap-3 @2xl:grid-cols-2">
        {(["evening", "challenge"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={busy}
            onClick={() => onStart(m)}
            className="press lift group flex min-h-11 flex-col items-start gap-2 rounded-3xl bg-card p-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="text-title">{modeInfo[m].title}</span>
              <span className="flex size-10 items-center justify-center rounded-full bg-me text-white transition-transform duration-(--duration-fast) group-hover:translate-x-0.5">
                <Play className="size-4.5" aria-hidden />
              </span>
            </span>
            <span className="font-mono text-caption text-muted-foreground">{modeInfo[m].length}</span>
            <span className="text-label font-normal text-ink-2">{modeInfo[m].detail}</span>
          </button>
        ))}
      </div>
    </SoftCard>
  );
}

type PlayerProps = {
  memberId: string;
  parents: Parent[];
  me: Parent;
  them?: Parent;
  session: VirtualBabySession;
  onUpdate: (s: VirtualBabySession) => void;
  onFinished: (s: VirtualBabySession) => Promise<void>;
  onReload: () => Promise<VirtualBaby | undefined>;
};

function Player({ memberId, parents, me, them, session, onUpdate, onFinished, onReload }: PlayerProps) {
  const [sim, setSim] = useState(() => reachedMinute(session));
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [feedback, setFeedback] = useState<VirtualBabyMoment>();
  const [reaction, setReaction] = useState<Reaction>();
  const [busy, startTransition] = useTransition();
  const lastHandler = session.moments.at(-1)?.handledBy;
  // Take turns: the next moment defaults to whoever did not take the last one.
  const [handler, setHandler] = useState(() => (them && lastHandler === me.id ? them.id : me.id));
  // The answer that finished the session: the summary opens after its feedback is read.
  const [doneSession, setDoneSession] = useState<VirtualBabySession>();

  const next = session.next;
  const arrived = !!next && sim >= next.minute && !feedback;
  const running = !!next && !arrived && !feedback && !paused && !hidden;

  // Pause whenever the tab is hidden: the simulation never runs in the background.
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!running || !next) return;
    const target = next.minute;
    const id = setInterval(() => setSim((m) => Math.min(target, m + SIM_MINUTES_PER_SECOND / 10)), 100);
    return () => clearInterval(id);
  }, [running, next]);

  const arrival = arrived ? next.seq + 1 : 0;

  function answer(choiceId: string) {
    if (!next) return;
    startTransition(async () => {
      const { data, response } = await api.POST("/members/{memberId}/virtual-baby-sessions/{sessionId}/moments", {
        params: { path: { memberId: handler, sessionId: session.id } },
        body: { seq: next.seq, choiceId },
      });
      if (!data) {
        if (response.status === 409) {
          toast("Someone already took this one. Here is where the baby is now.");
          await onReload();
        } else toast.error("Could not save that. Please try again.");
        return;
      }
      setFeedback(data.moment);
      setReaction({ action: data.moment.action, warm: data.moment.feedback.fit === "recommended", key: data.moment.seq });
      // Keep the player on screen (finishedAt unset locally) until the last feedback is read.
      onUpdate({ ...data.session, finishedAt: undefined });
      setDoneSession(data.session.finishedAt ? data.session : undefined);
    });
  }

  function carryOn() {
    const done = doneSession;
    setFeedback(undefined);
    if (done) {
      startTransition(() => onFinished(done));
      return;
    }
    if (them) setHandler((h) => (h === me.id ? them.id : me.id));
  }

  function end() {
    startTransition(async () => {
      const { data } = await api.PATCH("/members/{memberId}/virtual-baby-sessions/{sessionId}", {
        params: { path: { memberId, sessionId: session.id } },
        body: { finished: true },
      });
      if (!data) {
        toast.error("Could not end the session. Please try again.");
        return;
      }
      await onFinished(data);
    });
  }

  const clock = clockAt(session, sim);
  const night = isNight(clock);
  const waitingNeed = arrived ? next.need : undefined;
  const expression = waitingNeed ? needExpression[waitingNeed] : night || feedback?.need === "sleepy" ? "asleep" : "smile";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section aria-labelledby="vb-scene-title" className="relative isolate overflow-hidden rounded-[1.75rem] md:rounded-[2.25rem]">
        {/* Day and night washes crossfade as the simulated clock turns. */}
        <div aria-hidden className={cn("pp-vb-wash absolute inset-0 -z-10 bg-sun", night ? "opacity-0" : "opacity-100")} />
        <div aria-hidden className={cn("pp-vb-wash absolute inset-0 -z-10 bg-[#3A332C]", night ? "opacity-100" : "opacity-0")} />
        <Sky night={night} />

        <div className={cn("flex flex-col gap-4 p-5.5 md:p-8", night ? "text-[#FCEBD5]" : "text-ink")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={cn("text-caption font-semibold tracking-wider uppercase", night ? "text-[#E8D9C4]" : "text-ink-2")}>{modeInfo[session.mode].title}</p>
              <h1 id="vb-scene-title" className="mt-1 font-mono text-headline tabular-nums">
                {session.mode === "challenge" && <span className="mr-2 opacity-70">Day {dayAt(session, sim)}</span>}
                {formatClock(clock)}
              </h1>
              <p className={cn("mt-0.5 text-caption", night ? "text-[#E8D9C4]" : "text-muted-foreground")}>
                Simulated time{paused ? " · paused" : hidden ? " · paused while away" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {next && !arrived && !feedback && (
                <button type="button" onClick={() => setSim(next.minute)} className={cn(BTN, "bg-card/90 text-ink")}>
                  <FastForward className="size-4" aria-hidden />
                  Next moment
                </button>
              )}
              <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} className={cn(BTN, "bg-card/90 px-3.5 text-ink")}>
                {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                {paused ? "Resume" : "Pause"}
              </button>
              <button type="button" onClick={end} disabled={busy} className={cn(BTN, "bg-card/90 px-3.5 text-ink")}>
                <Flag className="size-4" aria-hidden />
                End here
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-80">
            <VirtualBabyFigure expression={expression} reaction={reaction} arrival={arrival} night={night} label={`The virtual baby${waitingNeed ? `, ${needLabel[waitingNeed].toLowerCase()}` : ""}. Tap to say hello.`} />
            <AnimatePresence>
              {waitingNeed && (
                <motion.span
                  key={next?.seq}
                  initial={{ opacity: 0, scale: 0.8, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={spring.playful}
                  className="absolute top-[4%] left-[2%] flex size-14 items-center justify-center rounded-full bg-card text-me shadow-[0_6px_20px_rgb(120_80_30/0.14)]"
                  aria-hidden
                >
                  {(() => {
                    const Icon = needIcon[waitingNeed];
                    return <Icon className="size-6" />;
                  })()}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <NeedMeters session={session} sim={sim} waiting={waitingNeed} night={night} />
          <Timeline session={session} sim={sim} memberId={memberId} night={night} />
        </div>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        {feedback ? (
          <motion.div key={`f${feedback.seq}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.24, ease: ease.out }}>
            <FeedbackCard moment={feedback} parents={parents} memberId={memberId} onNext={carryOn} busy={busy} last={!!doneSession} />
          </motion.div>
        ) : arrived ? (
          <motion.div key={`p${next.seq}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.24, ease: ease.out }}>
            <SoftCard as="section" aria-labelledby="vb-moment" className="flex flex-col gap-5">
              <div>
                <p className="flex items-center gap-2 text-caption font-semibold tracking-wider text-me uppercase">
                  {(() => {
                    const Icon = needIcon[next.need];
                    return <Icon className="size-4" aria-hidden />;
                  })()}
                  {needLabel[next.need]} · <span className="font-mono">{formatClock(clockAt(session, next.minute))}</span>
                </p>
                <h2 id="vb-moment" className="mt-2 text-headline">
                  {next.title}
                </h2>
                <p className="mt-2 max-w-prose text-body text-ink-2">{next.cue}</p>
              </div>
              {them && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-label text-muted-foreground">Taking this one</span>
                  <div role="radiogroup" aria-label="Who takes this one" className="flex gap-1.5 rounded-full bg-muted p-1">
                    {[me, them].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={handler === p.id}
                        onClick={() => setHandler(p.id)}
                        className={cn(
                          "press flex min-h-11 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 text-label transition-colors duration-(--duration-fast) outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          handler === p.id ? (p.id === memberId ? "bg-me-soft text-me" : "bg-them-soft text-them") : "text-muted-foreground",
                        )}
                      >
                        <Avatar person={p} />
                        {p.id === memberId ? "You" : p.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <ul className="grid gap-2.5">
                {next.choices.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => answer(c.id)}
                      className="press lift flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4.5 py-3 text-left text-body outline-none hover:border-line-2 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                    >
                      <span className="min-w-0 flex-1">{c.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </SoftCard>
          </motion.div>
        ) : (
          <motion.div key="calm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: ease.out }}>
            <SoftCard className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-title">{paused ? "Paused. The baby waits for you." : "All calm for now"}</p>
                <p className="mt-1 text-label font-normal text-muted-foreground">
                  {next
                    ? `Next moment around ${formatClock(clockAt(session, next.minute))}. Moment ${next.seq + 1} of ${session.momentCount}.`
                    : "That was the last moment."}
                </p>
              </div>
            </SoftCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sky({ night }: { night: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 120 120" className="pointer-events-none absolute top-5 right-5 -z-10 hidden size-24 @2xl:block md:top-8 md:right-8">
      <g className="pp-vb-sky">
        <g className={cn("pp-vb-wash", night ? "opacity-0" : "opacity-100")}>
          <circle cx="60" cy="60" r="22" fill="#F4CD6A" />
          <circle cx="60" cy="60" r="32" fill="#F4CD6A" opacity=".25" />
        </g>
        <g className={cn("pp-vb-wash", night ? "opacity-100" : "opacity-0")}>
          <path d="M66 34a26 26 0 1 0 22 38 22 22 0 0 1-22-38z" fill="#F4CD6A" />
          <path d="M28 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM96 92l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#FCEBD5" />
        </g>
      </g>
    </svg>
  );
}

function NeedMeters({ session, sim, waiting, night }: { session: VirtualBabySession; sim: number; waiting?: string; night: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-3 @2xl:grid-cols-4" aria-label="What the baby needs">
      {session.needs.map((n) => {
        const level = waiting === n.need ? 1 : needLevel(n, sim);
        const Icon = needIcon[n.need];
        return (
          <li key={n.need} className="flex items-center gap-2.5">
            <Icon className={cn("size-4.5 shrink-0", waiting === n.need ? "text-me" : night ? "text-[#E8D9C4]" : "text-ink-2")} aria-hidden />
            <span className="sr-only">
              {needLabel[n.need]}: {Math.round(level * 100)}%
            </span>
            <span aria-hidden className={cn("h-2 flex-1 overflow-hidden rounded-full", night ? "bg-white/15" : "bg-card/80")}>
              <span className={cn("pp-vb-meter block h-full rounded-full", level >= 0.85 ? "bg-me" : night ? "bg-[#E8D9C4]" : "bg-ink-2/50")} style={{ transform: `scaleX(${level})` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The session as dots on a line: handled moments in the colour of who took them, the clock as a marker. */
function Timeline({ session, sim, memberId, night }: { session: VirtualBabySession; sim: number; memberId: string; night: boolean }) {
  const pct = (m: number) => `${(m / session.lengthMinutes) * 100}%`;
  return (
    <div className="relative mt-1 h-5" aria-label={`${session.moments.length} of ${session.momentCount} moments handled`} role="img">
      <span className={cn("absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 rounded-full", night ? "bg-white/20" : "bg-ink/10")} />
      {session.moments.map((m) => (
        <span
          key={m.seq}
          className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full", m.handledBy === memberId ? "bg-me" : "bg-them")}
          style={{ left: pct(m.minute) }}
        />
      ))}
      <span className={cn("absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full", night ? "bg-[#FCEBD5]" : "bg-ink")} style={{ left: pct(sim) }} />
    </div>
  );
}

function FeedbackCard({ moment, parents, memberId, onNext, busy, last }: { moment: VirtualBabyMoment; parents: Parent[]; memberId: string; onNext: () => void; busy: boolean; last: boolean }) {
  const good = moment.feedback.fit === "recommended";
  const by = parents.find((p) => p.id === moment.handledBy);
  return (
    <SoftCard as="section" tone={good ? "leaf" : "sun"} aria-live="polite" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={good ? spring.playful : spring.ui}
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", good ? "bg-leaf text-white" : "bg-card text-ink-2")}
        >
          {good ? <Check className="size-5" aria-hidden /> : <Lightbulb className="size-5" aria-hidden />}
        </motion.span>
        <div className="min-w-0">
          <p className="text-caption text-muted-foreground">
            {by?.id === memberId ? "You" : by?.displayName} chose: {moment.choiceLabel}
          </p>
          <h2 className="mt-1 text-headline">{moment.feedback.headline}</h2>
        </div>
      </div>
      <p className="max-w-prose text-body text-ink-2">{moment.feedback.why}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SourceLine sources={[moment.feedback.source]} />
        <button type="button" onClick={onNext} disabled={busy} autoFocus className={cn(BTN, "bg-me text-white")}>
          {last ? "See what you practised" : "Carry on"}
        </button>
      </div>
    </SoftCard>
  );
}

function SessionLog({ session, parents, memberId }: { session: VirtualBabySession; parents: Parent[]; memberId: string }) {
  return (
    <SoftCard as="section" aria-labelledby="vb-log">
      <h2 id="vb-log" className="text-title">
        Who handled what
      </h2>
      <Share session={session} parents={parents} memberId={memberId} className="mt-4" />
      {session.moments.length === 0 ? (
        <p className="mt-4 text-label font-normal text-muted-foreground">The first moment is on its way. Decide who takes it, then swap.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-1.5">
          {session.moments
            .slice()
            .reverse()
            .map((m) => {
              const Icon = needIcon[m.need];
              const by = parents.find((p) => p.id === m.handledBy);
              return (
                <motion.li
                  key={m.seq}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring.ui}
                  className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5", m.handledBy === memberId ? "bg-me-soft" : "bg-them-soft")}
                >
                  <span className="w-16 shrink-0 font-mono text-caption text-muted-foreground">{formatClock(clockAt(session, m.minute))}</span>
                  <Icon className="size-4 shrink-0 text-ink-2" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-label">{m.title}</span>
                  {by && <Avatar person={by} size="sm" />}
                </motion.li>
              );
            })}
        </ol>
      )}
    </SoftCard>
  );
}

/** Who took how many moments, as one bar in the two accents. */
function Share({ session, parents, memberId, className }: { session: VirtualBabySession; parents: Parent[]; memberId: string; className?: string }) {
  const counts = parents.map((p) => ({ p, n: session.moments.filter((m) => m.handledBy === p.id).length }));
  const mine = counts.find((c) => c.p.id === memberId)?.n ?? 0;
  return (
    <div className={className}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="h-full bg-me" style={{ flexGrow: mine }} />
        <span className="h-full bg-them" style={{ flexGrow: session.moments.length - mine }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-label">
        {counts.map(({ p, n }) => (
          <span key={p.id} className={cn("inline-flex items-center gap-1.5", p.id === memberId ? "text-me" : "text-them")}>
            <Avatar person={p} size="sm" />
            {p.id === memberId ? "You" : p.displayName} <span className="font-mono">{n}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

/** "What you practised": topics with one dot per moment in the colour of who took it, then the ones worth a second look. */
function Summary({ session, parents, memberId, justNow = false, onAgain }: { session: VirtualBabySession; parents: Parent[]; memberId: string; justNow?: boolean; onAgain?: () => void }) {
  const revisit = session.moments.filter((m) => m.feedback.fit === "another_way");
  const handled = session.moments.length;
  const date = new Date(session.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <SoftCard as="section" tone={justNow ? "sun" : "plain"} hero={justNow} aria-labelledby="vb-summary" className="flex flex-col gap-5">
      <div>
        <p className="text-caption font-semibold tracking-wider text-ink-2 uppercase">
          {modeInfo[session.mode].title} · <span className="font-mono">{date}</span>
        </p>
        <h2 id="vb-summary" className={cn("mt-1", justNow ? "text-display" : "text-headline")}>
          What you practised
        </h2>
        <p className="mt-1 text-label font-normal text-muted-foreground">
          {handled === session.momentCount ? `All ${handled} moments, together.` : `${handled} of ${session.momentCount} moments before you stopped.`}
        </p>
      </div>
      <ul className="grid gap-3 @md:grid-cols-2">
        {session.practised.map((p) => {
          const Icon = needIcon[p.need];
          return (
            <li key={p.need} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card">
                <Icon className="size-4.5 text-ink-2" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-label">{needTopic[p.need]}</span>
              <span className="flex gap-1" aria-label={p.byMember.map((c) => `${parents.find((x) => x.id === c.memberId)?.displayName}: ${c.count}`).join(", ")}>
                {p.byMember.flatMap((c) =>
                  Array.from({ length: c.count }, (_, i) => <span key={`${c.memberId}${i}`} className={cn("size-2.5 rounded-full", c.memberId === memberId ? "bg-me" : "bg-them")} />),
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <Share session={session} parents={parents} memberId={memberId} />
      {revisit.length > 0 && (
        <div>
          <h3 className="text-title">Worth a second look</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {revisit.map((m) => (
              <li key={m.seq}>
                <details className="group rounded-2xl bg-muted px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-7 cursor-pointer list-none items-center gap-3 text-label">
                    <Lightbulb className="size-4 shrink-0 text-ink-2" aria-hidden />
                    <span className="min-w-0 flex-1">
                      {m.title}: {m.feedback.headline}
                    </span>
                  </summary>
                  <p className="mt-2 text-label font-normal text-ink-2">{m.feedback.why}</p>
                  <SourceLine sources={[m.feedback.source]} className="mt-2" />
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
      {onAgain && (
        <div>
          <button type="button" onClick={onAgain} className={cn(BTN, "bg-me text-white")}>
            Play again
          </button>
        </div>
      )}
    </SoftCard>
  );
}
