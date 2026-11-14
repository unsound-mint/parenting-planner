"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Stethoscope } from "lucide-react";
import { loadTopic } from "@/app/family/[memberId]/learn/questions/actions";
import { spring } from "@/components/joy/motion";
import { SourceLine } from "@/components/joy/source-line";
import { helpHref } from "@/components/shell/urgent-help-link";
import type { LibraryTopic, LibraryTopicSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { AskPrivately } from "./ask-privately";
import { categoryOf, evidenceTag } from "./visuals";

const FEELINGS = new Set(["emotions", "parent-wellbeing", "family", "behavior"]);

/**
 * One topic: the parent's question first, then what to know, what to do and
 * when to ask their own clinician, opening in place (no side panel). Urgent
 * topics show a plain link to the fixed Urgent help screen: never animated.
 */
export function TopicCard({
  memberId,
  topic,
  open,
  onToggle,
  onOpenRelated,
}: {
  memberId: string;
  topic: LibraryTopicSummary;
  open: boolean;
  onToggle: () => void;
  onOpenRelated: (id: string) => void;
}) {
  const [full, setFull] = useState<LibraryTopic | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLLIElement>(null);
  const cat = categoryOf(topic.category);
  const tag = evidenceTag[topic.evidence];

  useEffect(() => {
    if (!open || full) return;
    start(async () => {
      const t = await loadTopic(memberId, topic.id);
      if (t) setFull(t);
      else setFailed(true);
    });
  }, [open, full, memberId, topic.id]);

  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  return (
    <li ref={ref} id={`topic-${topic.id}`} className={cn("min-w-0 rounded-3xl border bg-card transition-colors duration-(--duration-base)", open ? "border-line-2" : "border-line")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="press flex w-full items-start gap-3.5 rounded-3xl p-4 text-left md:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-me-soft text-me" title={cat.label}>
          <cat.icon className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-title text-pretty">{topic.questions[0] ?? topic.title}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className={cn("rounded-full px-2.5 py-0.5 text-caption font-medium", tag.className)} title={tag.hint}>
              {tag.label}
            </span>
            <span className="font-mono text-caption text-muted-foreground">{topic.ages}</span>
            {topic.urgent && (
              <span className="inline-flex items-center gap-1 text-caption font-medium text-urgent">
                <span aria-hidden className="size-1.5 rounded-full bg-urgent" />
                Urgent signs inside
              </span>
            )}
          </span>
        </span>
        <ChevronDown className={cn("mt-2 size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-base)", open && "rotate-180")} aria-hidden />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.ui}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 px-4 pb-5 md:px-5 md:pl-[4.375rem]">
              <p className="text-label text-muted-foreground">{topic.title}</p>
              {!full && !failed && (
                <div className="flex flex-col gap-2" aria-busy>
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                </div>
              )}
              {failed && <p className="text-body text-ink-2">This topic did not load. Close it and try again.</p>}
              {full && (
                <>
                  <p className="max-w-prose text-body text-ink">{full.whatToKnow}</p>

                  {full.whatToDo.length > 0 && (
                    <ol className="flex max-w-prose flex-col gap-2.5 border-l-2 border-me-mid/50 pl-4">
                      {full.whatToDo.map((s, n) => (
                        <li key={n} className="min-w-0">
                          <p className="font-mono text-caption text-me">{s.when}</p>
                          <p className="text-body text-ink-2">{s.action}</p>
                        </li>
                      ))}
                    </ol>
                  )}

                  {full.askClinicianIf && (
                    <div className="flex max-w-prose items-start gap-3 rounded-2xl bg-leaf-soft p-3.5">
                      <Stethoscope className="mt-0.5 size-4.5 shrink-0 text-leaf" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-caption font-medium text-leaf">When to ask your own clinician</p>
                        <p className="text-label font-normal text-ink">{full.askClinicianIf}</p>
                      </div>
                    </div>
                  )}

                  {full.urgent && (
                    // Fixed and plain on purpose: Urgent help never animates.
                    <a href={helpHref(memberId)} className="inline-flex w-fit items-center gap-2 rounded-full bg-urgent px-4 py-2.5 text-label font-semibold text-white">
                      <span aria-hidden className="size-1.75 rounded-full bg-white" />
                      Seeing an urgent sign? Open Urgent help
                    </a>
                  )}

                  <div className="flex max-w-prose flex-col gap-1.5">
                    <p className="text-caption text-muted-foreground">
                      <span className="font-medium text-ink-2">{tag.label}.</span> {full.evidenceNote}
                    </p>
                    <SourceLine sources={full.sources} />
                  </div>

                  {asking ? (
                    <div className="max-w-prose">
                      <AskPrivately memberId={memberId} initial={topic.questions[0] ?? ""} feelings={FEELINGS.has(topic.category)} compact autoFocus />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAsking(true)}
                      className="press inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-line-2 bg-card px-4 text-label text-ink transition-colors duration-(--duration-fast) hover:bg-muted"
                    >
                      Ask about your own situation, privately
                    </button>
                  )}

                  {full.related.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-caption text-muted-foreground">Parents also read</p>
                      <div className="flex flex-wrap gap-2">
                        {full.related.slice(0, 4).map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => onOpenRelated(r.id)}
                            className="press min-h-9 rounded-full bg-muted px-3 text-left text-label font-normal text-ink-2 transition-colors duration-(--duration-fast) hover:bg-sun"
                          >
                            {r.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
