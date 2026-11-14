import { Heart } from "lucide-react";
import Link from "next/link";
import { SoftCard } from "@/components/joy/soft-card";
import type { PostcardLove } from "@/lib/api/types";
import { agoWords } from "@/lib/notifications";

/**
 * The hearts grandparents sent, for a parent's This week: who, their few words,
 * and when. With none yet it invites instead of saying "nothing": it points to
 * the postcard so the parent can see what to write for the family.
 */
export function LoveInbox({ loves, postcardHref, grandparentName }: { loves: readonly PostcardLove[]; postcardHref: string; grandparentName?: string }) {
  return (
    <SoftCard tone="me" as="section" aria-labelledby="love-title" className="flex flex-col gap-3">
      <h2 id="love-title" className="flex items-center gap-2 text-title">
        <Heart aria-hidden className="size-5 fill-current text-mom" />
        {loves.length ? "Love from the family" : "A postcard for the family"}
      </h2>
      {loves.length ? (
        <ul className="flex flex-col gap-2">
          {loves.slice(0, 3).map((l) => (
            <li key={l.id} className="rounded-2xl bg-card/70 px-4 py-3 text-body">
              <p>
                <span className="font-semibold">{l.fromName}</span> sent love
                <span className="ml-2 font-mono text-caption text-muted-foreground">{agoWords(l.sentAt)}</span>
              </p>
              {l.message && <p className="mt-0.5 text-ink-2">&ldquo;{l.message}&rdquo;</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-2">{grandparentName ?? "Your family"} can send you a heart from this week&apos;s postcard. Add a line to it first.</p>
      )}
      <Link href={postcardHref} className="press min-h-11 self-start rounded-full text-label font-semibold text-me underline underline-offset-4">
        {loves.length ? "See the postcard" : "Write this week's line"}
      </Link>
    </SoftCard>
  );
}
