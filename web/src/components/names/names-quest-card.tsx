import Link from "next/link";
import { ArrowRight, Heart, Trophy } from "lucide-react";
import type { Parent } from "@/lib/api/types";
import { serverApi } from "@/lib/api/server";
import { Avatar } from "@/components/joy/partner-chip";
import { SoftCard } from "@/components/joy/soft-card";
import { cn } from "@/lib/utils";

// The names quest at a glance, for This week and Learn: the matches so far,
// both parents' progress and the next step ("Swipe 10 more", the final round,
// or the top three). Render it inside <Suspense>. It renders nothing for a
// caregiver (404) or after the birth (409 quest_closed).

export async function NamesQuestCard({ memberId, parents, className }: { memberId: string; parents: Parent[]; className?: string }) {
  const api = await serverApi();
  const { data: quest } = await api.GET("/members/{memberId}/names-quest", { params: { path: { memberId } } });
  if (!quest) return null;
  const me = parents.find((p) => p.id === memberId);
  const them = parents.find((p) => p.id !== memberId);
  if (!me) return null;
  const mine = quest.progress.find((p) => p.memberId === memberId);
  const theirs = quest.progress.find((p) => p.memberId !== memberId);
  const left = Math.max(0, quest.swipeGoal - (mine?.swiped ?? 0));
  const next =
    quest.top.length > 0 && quest.finishedAt
      ? `Your top 3: ${quest.top.map((t) => t.name).join(", ")}`
      : quest.nextPair.length === 2
        ? `Final round: ${quest.nextPair[0].name} or ${quest.nextPair[1].name}?`
        : `Swipe ${left > 0 ? Math.min(10, left) : 10} more`;
  const href = `/family/${memberId}/learn/names`;

  return (
    <SoftCard as="section" aria-labelledby="names-quest-title" className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">Names quest</p>
          <h2 id="names-quest-title" className="mt-1 text-title">
            {quest.matches.length === 0 ? "Find a name you both love" : `${quest.matches.length} ${quest.matches.length === 1 ? "name" : "names"} you both love`}
          </h2>
        </div>
        <span className="flex gap-1" aria-label={`${quest.matches.length} of ${quest.matchGoal} matches for the final round`}>
          {Array.from({ length: quest.matchGoal }, (_, i) => (
            <Heart key={i} className={cn("size-4", i < quest.matches.length ? "fill-me text-me" : "text-line-2")} />
          ))}
        </span>
      </div>

      {quest.matches.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {quest.matches.slice(0, 4).map((m) => (
            <li key={m.name} className="rounded-full bg-me-soft px-3.5 py-1.5 text-title text-me">
              {m.name}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2">
        <Bar person={me} label="You" n={mine?.swiped ?? 0} goal={quest.swipeGoal} tone="me" />
        {them && theirs && <Bar person={them} label={them.displayName} n={theirs.swiped} goal={quest.swipeGoal} tone="them" />}
      </div>

      <Link href={href} className="press inline-flex min-h-11 items-center justify-between gap-2 rounded-full bg-me px-5 text-label text-white">
        <span className="inline-flex items-center gap-2">
          {quest.nextPair.length === 2 || quest.finishedAt ? <Trophy className="size-4" /> : <Heart className="size-4" />}
          {next}
        </span>
        <ArrowRight className="size-4" />
      </Link>
    </SoftCard>
  );
}

function Bar({ person, label, n, goal, tone }: { person: Parent; label: string; n: number; goal: number; tone: "me" | "them" }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar person={person} size="sm" />
      <span className="w-16 truncate text-label font-normal text-ink-2">{label}</span>
      <span className={cn("relative h-1.5 flex-1 overflow-hidden rounded-full", tone === "me" ? "bg-me-soft" : "bg-them-soft")}>
        <span className={cn("absolute inset-y-0 left-0 rounded-full", tone === "me" ? "bg-me" : "bg-them")} style={{ width: `${Math.min(100, (n / goal) * 100)}%` }} />
      </span>
      <span className="w-12 text-right font-mono text-caption text-muted-foreground">
        {Math.min(n, goal)}/{goal}
      </span>
    </div>
  );
}
