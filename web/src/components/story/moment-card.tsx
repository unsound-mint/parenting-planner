import { BookOpen, ClipboardList, HandHeart, Heart, MessageCircleHeart, MessagesSquare, NotebookPen, Sparkles, Star, Stethoscope, Syringe, Home, type LucideIcon } from "lucide-react";
import type { StoryMoment, StoryMomentKind } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, PartnerChip } from "@/components/joy/partner-chip";
import { SourceLine } from "@/components/joy/source-line";
import { SizeIllustration, StageMascot } from "@/components/illustrations";

export const momentIcon: Record<StoryMomentKind, LucideIcon> = {
  pregnancy_week: Sparkles,
  appointment: Stethoscope,
  journal: NotebookPen,
  baby_home: Home,
  care_log: ClipboardList,
  handoff: HandHeart,
  vaccines: Syringe,
  stage_line: Sparkles,
  lesson_read: BookOpen,
  quiz_compared: MessagesSquare,
  names_liked: Heart,
  couple_talk: MessageCircleHeart,
};

/** Who did it: one person as a chip, two or more as overlapping avatars with their names. */
function People({ people }: { people: Person[] }) {
  if (people.length === 0) return null;
  if (people.length === 1)
    return (
      <span className="self-start">
        <PartnerChip person={people[0]} />
      </span>
    );
  const names = people.map((p) => p.displayName);
  return (
    <span className="inline-flex items-center gap-2 self-start text-label text-ink-2">
      <span className="flex -space-x-1.5">
        {people.map((p) => (
          <Avatar key={p.id} person={p} size="sm" className="ring-2 ring-card" />
        ))}
      </span>
      {names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`}
    </span>
  );
}

/** The date line every page carries: an icon, then the day in mono. */
function DateLine({ moment, extra }: { moment: StoryMoment; extra?: React.ReactNode }) {
  const Icon = momentIcon[moment.kind];
  return (
    <p className="flex items-center gap-2 font-mono text-caption text-muted-foreground">
      <Icon className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
      <time dateTime={moment.on}>{formatLongDate(moment.on)}</time>
      {extra}
    </p>
  );
}

/**
 * One page of the book. The layout follows the kind: the arrival is a big sun
 * card with the newborn, a week shows its fruit, a shared line is a quote, the
 * names are set large. Everything else is a quiet card with who did it.
 */
export function MomentCard({ moment, people, childName }: { moment: StoryMoment; people: Person[]; childName?: string }) {
  const base = "relative min-w-0 rounded-3xl p-4.5 md:p-5";

  if (moment.kind === "baby_home") {
    return (
      <article className={cn(base, "grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-4 bg-sun md:grid-cols-[minmax(0,1fr)_9rem]")}>
        <div className="flex min-w-0 flex-col gap-2">
          <DateLine moment={moment} />
          <h4 className="text-headline">{moment.title}</h4>
          {moment.detail && <p className="text-body text-ink-2">{moment.detail}</p>}
          <People people={people} />
        </div>
        <span className="block aspect-[300/260] w-full">
          <StageMascot stage="postpartum" heart interactive={false} seed={moment.id} label={childName ? `${childName} as a newborn` : undefined} />
        </span>
      </article>
    );
  }

  if (moment.kind === "pregnancy_week" && moment.comparison) {
    return (
      <article className={cn(base, "grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 border border-line bg-card md:grid-cols-[5.5rem_minmax(0,1fr)]")}>
        <span className="block aspect-[300/260] w-full">
          <SizeIllustration comparison={moment.comparison} week={moment.week} heart={false} interactive={false} seed={moment.id} />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <DateLine moment={moment} extra={<span className="rounded-full bg-muted px-2 py-0.5 text-ink-2">Week {moment.week}</span>} />
          <h4 className="text-title">{moment.title}</h4>
          {moment.sources && <SourceLine sources={moment.sources} />}
        </div>
      </article>
    );
  }

  if (moment.kind === "names_liked" && moment.names) {
    const names = moment.names;
    return (
      <article className={cn(base, "flex flex-col gap-3 bg-them-soft")}>
        <DateLine moment={moment} />
        <h4 className="sr-only">{moment.title}</h4>
        <p className="text-label text-ink-2">You both like</p>
        <ul className="flex flex-wrap gap-2">
          {names.map((n) => (
            <li key={n} className="rounded-full bg-card px-3.5 py-1 text-title text-ink">
              {n}
            </li>
          ))}
        </ul>
        <People people={people} />
      </article>
    );
  }

  if ((moment.kind === "journal" || moment.kind === "couple_talk") && moment.quote) {
    return (
      <article className={cn(base, "flex flex-col gap-3", moment.kind === "journal" ? "bg-me-soft" : "bg-leaf-soft")}>
        <DateLine
          moment={moment}
          extra={
            moment.first ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-butter px-2 py-0.5 font-sans font-semibold text-ink">
                <Star className="size-3 fill-current" aria-hidden />
                First
              </span>
            ) : undefined
          }
        />
        <h4 className="text-label text-ink-2">{moment.title}</h4>
        <blockquote className="text-title text-ink italic">{moment.quote}</blockquote>
        <People people={people} />
      </article>
    );
  }

  const quiet = moment.kind === "stage_line" || moment.kind === "vaccines";
  return (
    <article className={cn(base, "flex flex-col gap-2", quiet ? "bg-muted/70" : "border border-line bg-card")}>
      <DateLine moment={moment} />
      <h4 className={quiet ? "text-body font-medium text-ink" : "text-title"}>{moment.title}</h4>
      {moment.kind === "care_log" && moment.count ? (
        <p className="flex items-baseline gap-2 text-label text-ink-2">
          <span className="font-mono text-headline text-ink">{moment.count}</span>
          feeds, naps and changes so far
        </p>
      ) : (
        moment.detail && <p className="text-label text-ink-2">{moment.detail}</p>
      )}
      {moment.kind === "handoff" && moment.count && moment.count > 1 ? <p className="font-mono text-caption text-muted-foreground">{moment.count} times</p> : null}
      <People people={people} />
      {moment.sources && <SourceLine sources={moment.sources} />}
    </article>
  );
}
