import Link from "next/link";
import { BookOpen, CircleHelp, GraduationCap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Format, LibraryItem } from "./catalogue";

const formatIcon: Record<Format, LucideIcon> = { article: BookOpen, lesson: GraduationCap, quiz: CircleHelp };
const formatWord: Record<Format, string> = { article: "Article", lesson: "Lesson", quiz: "Quiz" };

/**
 * One library entry as a compact tile: format, title, one line, length and
 * state. Coming-soon tiles are dashed, muted and not links: they carry no
 * text to read, only what is planned.
 */
export function LibraryCard({ item }: { item: LibraryItem }) {
  const Icon = formatIcon[item.format];
  const body = (
    <>
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span>{formatWord[item.format]}</span>
        <span aria-hidden>·</span>
        <span>{item.minutes} min</span>
        <Badge item={item} />
      </div>
      <p className={cn("line-clamp-2 text-title text-balance", item.soon && "text-ink-2")}>{item.title}</p>
      <p className="line-clamp-2 text-label font-normal text-ink-2">{item.line}</p>
    </>
  );
  if (!item.href) {
    return (
      <li className="flex min-w-0 flex-col gap-1.5 rounded-3xl border border-dashed border-line-2 p-4" aria-label={`${item.title}, coming soon`}>
        {body}
      </li>
    );
  }
  return (
    <li className="min-w-0">
      <Link
        href={item.href}
        className="press flex h-full min-w-0 flex-col gap-1.5 rounded-3xl border border-line bg-card p-4 transition-colors duration-(--duration-fast) hover:border-line-2"
      >
        {body}
      </Link>
    </li>
  );
}

function Badge({ item }: { item: LibraryItem }) {
  const tag = item.soon
    ? { label: "Coming soon", className: "bg-muted text-muted-foreground" }
    : item.state === "read"
      ? { label: "Read", className: "bg-leaf-soft text-leaf" }
      : item.state === "reading"
        ? { label: "Reading", className: "bg-me-soft text-me" }
        : item.now
          ? { label: "For now", className: "bg-sun text-ink-2" }
          : item.state === "new"
            ? { label: "New", className: "bg-me-soft text-me" }
            : null;
  if (!tag) return null;
  return <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold", tag.className)}>{tag.label}</span>;
}
