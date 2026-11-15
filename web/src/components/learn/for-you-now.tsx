import Link from "next/link";
import { ArrowRight, CircleHelp, GraduationCap, Library } from "lucide-react";
import type { LearningPath, Parent } from "@/lib/api/types";
import { heroPath, minutesWord, nextLesson } from "./model";

/**
 * The two picks beside this week's read in "For you now": the next lesson
 * (the same one the path board opens on) and one quiz deck to continue. Each
 * is one card that links where the work happens; nothing here repeats a fact
 * shown elsewhere on Learn.
 */
export function ForYouNow({ memberId, paths, me }: { memberId: string; paths: LearningPath[]; me: Parent }) {
  const base = `/family/${memberId}/learn`;
  const path = heroPath(paths, me);
  const lesson = path && nextLesson(path, me);
  const open = (p: LearningPath) => p.lessons.flatMap((l) => l.quiz).filter((q) => !q.answers.some((a) => a.memberId === me.id)).length;
  const deck = paths.find((p) => open(p) > 0) ?? paths.find((p) => p.lessons.some((l) => l.quiz.length > 0));
  const left = deck ? open(deck) : 0;
  return (
    <div className="grid min-w-0 gap-4 @xl:grid-cols-2 @7xl:grid-cols-1">
      {lesson && path && (
        <Pick
          href={`${base}?path=${encodeURIComponent(path.id)}&lesson=${encodeURIComponent(lesson.id)}`}
          icon={<GraduationCap className="size-4.5" aria-hidden />}
          kicker={`Next lesson · ${minutesWord(lesson.minutes)}`}
          title={lesson.title}
          line={path.title}
        />
      )}
      {deck && (
        <Pick
          href={`${base}/quizzes?deck=${encodeURIComponent(deck.id)}`}
          icon={<CircleHelp className="size-4.5" aria-hidden />}
          kicker={left > 0 ? `Quiz · ${left} ${left === 1 ? "question" : "questions"} to go` : "Quiz · retake to see what stuck"}
          title={deck.title}
          line={left > 0 ? "Continue the deck" : "Every question answered"}
        />
      )}
    </div>
  );
}

function Pick({ href, icon, kicker, title, line }: { href: string; icon: React.ReactNode; kicker: string; title: string; line: string }) {
  return (
    <Link href={href} className="press group flex min-w-0 items-start gap-3.5 rounded-3xl border border-line bg-card p-5 transition-colors duration-(--duration-fast) hover:border-line-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-me-soft text-me">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-caption font-semibold tracking-wider text-ink-2 uppercase">{kicker}</span>
        <span className="text-title text-balance">{title}</span>
        <span className="text-label font-normal text-ink-2">{line}</span>
      </span>
      <ArrowRight className="mt-2 size-4.5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** The way into the library, after the paths: one line with the honest count. */
export function LibraryEntry({ memberId, ready, soon }: { memberId: string; ready: number; soon: number }) {
  return (
    <Link
      href={`/family/${memberId}/learn/library`}
      className="press group flex min-w-0 items-center gap-4 rounded-3xl border border-line bg-card p-5 transition-colors duration-(--duration-fast) hover:border-line-2 md:p-6"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sun text-ink-2">
        <Library className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-title">Browse the library</span>
        <span className="text-label font-normal text-ink-2">
          {ready} to read now, {soon} coming soon: every topic on its own shelf, with search
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
