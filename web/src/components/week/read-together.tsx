import Link from "next/link";
import type { LearningPath, Parent } from "@/lib/api/types";
import { Avatar } from "@/components/joy/partner-chip";
import { cn } from "@/lib/utils";
import { ClosableNudge } from "./closable-nudge";
import { ReadCover } from "./read-cover";
import { pickQuiz, pickReads, type ReadPick } from "./this-week";
import "./week.css";

// "Read together this week": three short reads from the learning paths with
// both parents' state, then one quiz to compare answers. Reads come from GET
// /learning-paths; the choice is pickReads (this-week.ts).

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" });

export function ReadTogether({
  memberId,
  paths,
  me,
  partner,
  now,
  closedNudgeIds = [],
  className,
}: {
  memberId: string;
  paths: LearningPath[];
  me: Parent;
  partner?: Parent;
  now: Date;
  /** Nudges this parent closed (GET /together). */
  closedNudgeIds?: string[];
  className?: string;
}) {
  const { path, reads } = pickReads(paths, me.id);
  const quiz = pickQuiz(paths, me.id);
  if (!path || reads.length === 0) return null;
  const href = (lessonId: string) => `/family/${memberId}/learn#${lessonId}`;
  // With the partner's answers in, the strip is a nudge to compare: the parent
  // can close it. The id is the one the server gives its own quiz nudge, so
  // closing either one closes both; the next quiz has a new id.
  const compareId = quiz?.partnerAnsweredAt && partner ? `quiz_answered:${quiz.lesson.id}:${Math.floor(Date.parse(quiz.partnerAnsweredAt) / 1000)}` : undefined;
  const strip = "flex flex-wrap items-center gap-4 rounded-3xl bg-leaf-soft px-5 py-4";
  const quizBody = quiz && (
    <>
  <svg viewBox="0 0 40 40" className="hidden size-10 shrink-0 sm:block" aria-hidden>
    <path d="M20 2.5c6.9 0 13.1 3.8 15.6 9.4s1.9 13.1-1.9 18.1-10.6 7.5-16.9 6.9S5 33.1 3.1 27.5 1.9 15 5.6 9.4 13.1 2.5 20 2.5z" fill="#B7CFA4" />
    <text x="20" y="26" textAnchor="middle" className="font-heading" fontWeight="600" fontSize="17" fill="#2F4A2A">
      ?
    </text>
  </svg>
  <div className="min-w-0 flex-1">
    <p className="text-title">{quiz.lesson.title}</p>
    <p className="text-label font-normal text-ink-2">
      {countQuestions(quiz.questions.length)}
      {quiz.partnerAnsweredAt && partner
        ? `. ${partner.displayName} took it ${dayWords(quiz.partnerAnsweredAt, now)}, so compare answers tonight.`
        : partner
          ? `, then see what ${partner.displayName} picks.`
          : "."}
    </p>
  </div>
  <Link
    href={href(quiz.lesson.id)}
    className="press inline-flex min-h-11 items-center rounded-full border border-line-2 px-4.5 text-label font-semibold text-ink-2 transition-colors duration-(--duration-fast) hover:bg-card"
  >
    Try it
  </Link>
    </>
  );
  const progress = (id: string) => path.progress.find((p) => p.memberId === id)?.finished ?? 0;

  return (
    <section aria-labelledby="reads-title" className={cn("flex min-w-0 flex-col gap-4.5", className)}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <h2 id="reads-title" className="text-headline">
          Read together this week
        </h2>
        <p className="flex items-center gap-4 text-label font-normal text-muted-foreground @4xl:ml-auto">
          <span>{path.title}</span>
          {[me, partner].filter((p): p is Parent => !!p).map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5" title={`${p.displayName} finished ${progress(p.id)} of ${path.lessons.length}`}>
              <Avatar person={p} size="sm" />
              <span className="font-mono">
                {progress(p.id)} of {path.lessons.length}
              </span>
            </span>
          ))}
        </p>
      </div>

      {/* Phones: a swipeable row. Wider: three cards side by side. */}
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] @2xl:mx-0 @2xl:grid @2xl:grid-cols-3 @2xl:gap-4.5 @2xl:overflow-visible @2xl:px-0">
        {reads.map((r, n) => (
          <li key={r.lesson.id} className="flex w-[72%] shrink-0 snap-start @2xl:w-auto">
            <ReadCard pick={r} href={href(r.lesson.id)} partner={partner} index={reads.slice(0, n).filter((x) => x.lesson.pathId === r.lesson.pathId).length} />
          </li>
        ))}
      </ul>

      {quiz &&
        quizBody &&
        (compareId ? (
          !closedNudgeIds.includes(compareId) && (
            <ClosableNudge memberId={memberId} id={compareId} collapseGap="-1.125rem" className={strip}>
              {quizBody}
            </ClosableNudge>
          )
        ) : (
          <div className={strip}>{quizBody}</div>
        ))}
    </section>
  );
}

const words = ["No", "One", "Two", "Three", "Four", "Five", "Six"];
function countQuestions(n: number) {
  return `${words[n] ?? n} ${n === 1 ? "question" : "questions"}`;
}

function dayWords(iso: string, now: Date) {
  const days = Math.round((Date.parse(now.toISOString().slice(0, 10)) - Date.parse(iso.slice(0, 10))) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return days < 7 ? `on ${weekday.format(new Date(iso))}` : "earlier";
}

function ReadCard({ pick, href, partner, index }: { pick: ReadPick; href: string; partner?: Parent; index: number }) {
  const { lesson, state } = pick;
  const forPartners = lesson.audience.length === 1 && lesson.audience[0] === "partner";
  const chip =
    state === "started"
      ? { text: "You started it", tone: "bg-me-soft text-me" }
      : state === "partner_read" && partner
        ? { text: `${partner.displayName} read it`, tone: "bg-them-soft text-them" }
        : state === "partner_started" && partner
          ? { text: `${partner.displayName} is reading it`, tone: "bg-them-soft text-them" }
          : { text: "New", tone: "bg-muted text-ink-2" };
  return (
    <Link
      href={href}
      className="pp-wk-read lift press group flex w-full flex-col overflow-hidden rounded-3xl border border-line bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="relative block h-28 overflow-hidden @4xl:h-33">
        <ReadCover pathId={lesson.pathId} lessonId={lesson.id} index={index} />
        <span className="pp-wk-curl" aria-hidden />
      </span>
      <span className="flex flex-1 flex-col gap-2 px-4.5 pt-4 pb-4.5">
        <span className="text-title text-pretty">{lesson.title}</span>
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-label font-normal text-muted-foreground">
          <span className={cn("rounded-full px-2.5 py-0.5 text-caption font-medium", chip.tone)}>{chip.text}</span>
          {forPartners && <span className="rounded-full bg-muted px-2.5 py-0.5 text-caption">For partners</span>}
          <span className="font-mono text-caption">{lesson.minutes} min</span>
        </span>
      </span>
    </Link>
  );
}
