import Link from "next/link";
import { Lock, Users } from "lucide-react";
import type { Story } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { StoryArt } from "./story-art";

/** The family's books as covers. Each opens the reader. */
export function StoryShelf({ memberId, stories, names }: { memberId: string; stories: Story[]; names: Map<string, string> }) {
  return (
    <ul className="grid grid-cols-2 gap-4 @2xl:grid-cols-3">
      {stories.map((s) => (
        <li key={s.id}>
          <StoryCover memberId={memberId} story={s} author={s.authorId === memberId ? undefined : names.get(s.authorId)} />
        </li>
      ))}
    </ul>
  );
}

export function StoryCover({ memberId, story, author }: { memberId: string; story: Story; author?: string }) {
  const shared = story.visibility === "partner";
  return (
    <Link
      href={`/family/${memberId}/baby/storybook/${story.id}`}
      className="press lift flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card"
    >
      <StoryArt art={story.pages[0]?.art ?? "hearts"} ageMonths={story.ageMonths} seed={story.id} />
      <span className="flex flex-1 flex-col gap-1 p-3.5">
        <span className="text-title text-balance">{story.title}</span>
        <span className="mt-auto flex items-center gap-1.5 pt-1 font-mono text-caption text-muted-foreground">
          {author ? <Users aria-hidden className="size-3" /> : shared ? <Users aria-hidden className="size-3" /> : <Lock aria-hidden className="size-3" />}
          {author ? `From ${author}` : shared ? "Shared" : "Only you"} · {formatShortDate(story.createdAt)}
        </span>
      </span>
    </Link>
  );
}
