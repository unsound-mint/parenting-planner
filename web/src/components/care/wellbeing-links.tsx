"use client";

import Link from "next/link";
import { ChevronRight, ClipboardCheck, type LucideIcon } from "lucide-react";
import type { DiaryEntry, ScreeningQuestionnaire } from "@/lib/api/types";
import { careIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { mergeDiary, useMockDiary } from "@/lib/mock/diary-store";

// Two doors from Care to the parent's own wellbeing. Each hides when its
// endpoint failed, so a missing backend never leaves a dead link.
export function WellbeingLinks({ memberId, entries: server, questionnaires }: { memberId: string; entries?: DiaryEntry[]; questionnaires?: ScreeningQuestionnaire[] }) {
  // Entries saved while the diary is a mock come from the browser (see lib/mock/diary-store.ts).
  const remembered = useMockDiary(memberId);
  const entries = server && mergeDiary(server, remembered);
  if (!entries && !questionnaires) return null;
  const suggested = questionnaires?.some((q) => q.suggested);
  return (
    <section aria-label="Your wellbeing" className="grid gap-3 sm:grid-cols-2 @4xl:grid-cols-1 @6xl:grid-cols-2 @7xl:grid-cols-1">
      {entries && (
        <Door
          href={`/family/${memberId}/care/journal`}
          icon={careIcon.diary}
          title="Journal"
          hint={entries.length === 0 ? "Write what is on your mind" : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}, private`}
        />
      )}
      {questionnaires && (
        <Door
          href={`/family/${memberId}/care/screening`}
          icon={ClipboardCheck}
          title="Mood questionnaire"
          hint={suggested ? "Due now, takes 2 minutes" : "Check in with yourself"}
          highlight={suggested}
        />
      )}
    </section>
  );
}

function Door({ href, icon: Icon, title, hint, highlight }: { href: string; icon: LucideIcon; title: string; hint: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-4 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        highlight ? "border-primary" : "border-border",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-title">{title}</span>
        <span className={cn("block text-caption", highlight ? "font-medium text-primary" : "text-muted-foreground")}>{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
