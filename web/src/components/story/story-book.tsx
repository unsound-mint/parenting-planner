import { CalendarHeart, Feather } from "lucide-react";
import type { Story, StoryChapter, StoryInvitation } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SizeIllustration, StageMascot } from "@/components/illustrations";
import { MomentCard, momentIcon } from "./moment-card";
import { StoryReveal } from "./story-reveal";

// The baby grows from chapter to chapter: each chapter's illustration is a
// step bigger than the one before, up to the size of the cover.
const GROW = ["w-24", "w-28", "w-32", "w-36", "w-40", "w-44"];
const GROW_WIDE = ["@5xl:w-[52%]", "@5xl:w-[62%]", "@5xl:w-[72%]", "@5xl:w-[82%]", "@5xl:w-[91%]", "@5xl:w-full"];

function ChapterArt({ chapter, index, childName }: { chapter: StoryChapter; index: number; childName?: string }) {
  const step = Math.min(index, GROW.length - 1);
  return (
    <span data-reveal className={cn("pp-story-grow block aspect-[300/260] shrink-0", GROW[step], GROW_WIDE[step])}>
      {chapter.comparison ? (
        <SizeIllustration comparison={chapter.comparison} heart={chapter.current} interactive={chapter.current} seed={`chapter-${chapter.kind}`} />
      ) : (
        <StageMascot
          stage={chapter.stage}
          heart={chapter.current}
          interactive={chapter.current}
          seed={`chapter-${chapter.kind}`}
          label={childName ? `${childName}, ${chapter.span ?? chapter.title}` : undefined}
        />
      )}
    </span>
  );
}

function ChapterHeader({ chapter, index, childName }: { chapter: StoryChapter; index: number; childName?: string }) {
  return (
    <header className="flex items-end gap-5 @5xl:sticky @5xl:top-6 @5xl:flex-col @5xl:items-start @5xl:gap-4 @5xl:self-start">
      <ChapterArt chapter={chapter} index={index} childName={childName} />
      <div data-reveal className="pp-story-reveal flex min-w-0 flex-col gap-1.5">
        <p className="text-caption font-semibold tracking-wider text-muted-foreground uppercase">
          Chapter {index + 1}
          {chapter.current && <span className="ml-2 rounded-full bg-me-soft px-2 py-0.5 tracking-normal text-me normal-case">You are here</span>}
        </p>
        <h3 className="text-headline">{chapter.title}</h3>
        <p className="font-mono text-caption text-muted-foreground">
          {chapter.span && <span className="text-ink-2">{chapter.span} · </span>}
          {formatLongDate(chapter.startsOn)} to {chapter.endsOn ? formatLongDate(chapter.endsOn) : "today"}
        </p>
      </div>
    </header>
  );
}

function Invitations({ next, empty }: { next: StoryInvitation[]; empty: boolean }) {
  return (
    <section data-reveal aria-labelledby="story-next" className="pp-story-reveal rounded-3xl border-2 border-dashed border-line-2 p-5 md:p-7">
      <p id="story-next" className="flex items-center gap-2 text-title">
        <Feather className="size-5 text-me" strokeWidth={1.7} aria-hidden />
        {empty ? "Your first page is written when…" : "The next page is written when…"}
      </p>
      <ul className="mt-4 grid gap-3 @4xl:grid-cols-2">
        {next.map((n) => {
          const Icon = n.on ? CalendarHeart : momentIcon[n.kind];
          return (
            <li key={n.kind + n.title} className="flex items-start gap-3 rounded-2xl bg-muted/70 px-4 py-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-ink-2" strokeWidth={1.7} aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="text-body text-ink">…{n.title}</span>
                {n.on && <time dateTime={n.on} className="font-mono text-caption text-muted-foreground">{formatLongDate(n.on)}</time>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The book itself: chapters oldest first, each with its baby, title and dates
 * on the left (sticky on wide screens) and its pages on the right, along a
 * thread that draws itself as the chapter scrolls in. Pages rise in as they
 * arrive. The invitations close the book, so it never just stops.
 */
export function StoryBook({ story, people, childName }: { story: Story; people: Person[]; childName?: string }) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const empty = story.chapters.every((c) => c.moments.length === 0);
  return (
    <StoryReveal className="flex flex-col gap-12 md:gap-16">
      {story.chapters.map((chapter, index) => (
        <section key={chapter.kind} id={`chapter-${index + 1}`} aria-label={`Chapter ${index + 1}: ${chapter.title}`} className="grid scroll-mt-6 gap-6 @5xl:grid-cols-[minmax(15rem,22rem)_minmax(0,1fr)] @5xl:gap-10">
          <ChapterHeader chapter={chapter} index={index} childName={childName} />
          <div className="relative pl-5 md:pl-7">
            <span data-reveal aria-hidden className="pp-story-line absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-line-2" />
            <ol className="grid gap-4 @7xl:grid-cols-2">
              {chapter.moments.map((m) => (
                <li key={m.id} data-reveal className={cn("pp-story-reveal min-w-0", (m.kind === "baby_home" || (m.quote && m.quote.length > 120)) && "@7xl:col-span-2")}>
                  <MomentCard moment={m} people={m.peopleIds.flatMap((id) => byId.get(id) ?? [])} childName={childName} />
                </li>
              ))}
            </ol>
            {chapter.current && (
              <div className="mt-6">
                <Invitations next={story.next} empty={empty} />
              </div>
            )}
          </div>
        </section>
      ))}
    </StoryReveal>
  );
}
