"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Annoyed, ChevronDown, Frown, Laugh, ListPlus, Lock, Meh, Smile, type LucideIcon } from "lucide-react";
import { api, isPreviewMock } from "@/lib/api/client";
import { mergeDiary, rememberMockEntry, useMockDiary } from "@/lib/mock/diary-store";
import type { DiaryEntry, MoodCheckin, Visibility } from "@/lib/api/types";
import { dayKey, formatDayNumber, formatMonth } from "@/lib/format";
import { careIcon, visibilityIcon, visibilityLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageGrid } from "@/components/shell/page";

type Partner = { id: string; name: string };

const moodFace: Record<number, { icon: LucideIcon; label: string }> = {
  1: { icon: Frown, label: "Very low" },
  2: { icon: Annoyed, label: "Low" },
  3: { icon: Meh, label: "Okay" },
  4: { icon: Smile, label: "Good" },
  5: { icon: Laugh, label: "Very good" },
};

const TOPIC_MAX = 80;

// Write box plus the list. Entries are private by default; sharing is per entry
// and only ever with the partner. The agenda topic is a short label for the
// psychologist session, never the entry text. The API does not change an entry's
// text, so editing here means audience and agenda topic.
export function Journal({ memberId, partner, entries: initial, moods }: { memberId: string; partner?: Partner; entries: DiaryEntry[]; moods: MoodCheckin[] }) {
  const [local, setEntries] = useState(initial);
  // While the diary endpoints are mocks, entries saved earlier in this session come back from the browser.
  const entries = mergeDiary(local, useMockDiary(memberId));
  const Diary = careIcon.diary;
  const moodByDay = new Map<string, number>();
  // Newest first, so the first check-in of a day wins.
  for (const m of moods) if (!moodByDay.has(dayKey(m.recordedAt))) moodByDay.set(dayKey(m.recordedAt), m.mood);

  return (
    <div className="mt-2 flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-3 text-headline">
          <Diary className="size-7 text-primary" aria-hidden />
          Journal
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-label font-normal text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Private to you unless you share an entry.
        </p>
      </div>

      {/* Two columns: the write box on the left, the entries beside it. */}
      <PageGrid>
        <WriteBox memberId={memberId} partner={partner} onSaved={(e) => setEntries((cur) => [e, ...cur])} />

        {entries.length === 0 ? (
          <p className="text-label text-muted-foreground">Nothing written yet. Whatever you put down stays yours.</p>
        ) : (
          <section aria-label="Entries" className="flex min-w-0 flex-col gap-3">
            <h2 className="font-mono text-caption tracking-[0.07em] text-muted-foreground uppercase">
              Entries
            </h2>
            <ul className="flex flex-col gap-3">
              {entries.map((e) => (
                <li key={e.id}>
                  <Entry
                    memberId={memberId}
                    entry={e}
                    partner={partner}
                    mood={moodByDay.get(dayKey(e.writtenAt))}
                    onChange={(next) => setEntries((cur) => cur.map((x) => (x.id === next.id ? next : x)))}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageGrid>
    </div>
  );
}

function Audience({ value, onChange, partner, compact }: { value: Visibility; onChange: (v: Visibility) => void; partner?: Partner; compact?: boolean }) {
  const options: { value: Visibility; label: string }[] = [
    { value: "private", label: "Only me" },
    ...(partner ? [{ value: "partner" as const, label: `Me and ${partner.name}` }] : []),
  ];
  return (
    <div role="radiogroup" aria-label="Who can read this entry" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const Icon = visibilityIcon[o.value];
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              compact && "md:min-h-9",
              on ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AgendaField({ on, onToggle, topic, onTopic, id }: { on: boolean; onToggle: () => void; topic: string; onTopic: (t: string) => void; id: string }) {
  const Agenda = careIcon.agenda;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={cn(
          "inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border px-3 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          on ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
        )}
      >
        <Agenda className="size-4" aria-hidden />
        Add a topic to my psychologist agenda
      </button>
      {on && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-caption text-muted-foreground">
            Only this short topic goes on the agenda, not what you wrote.
          </label>
          <Input id={id} value={topic} maxLength={TOPIC_MAX} onChange={(e) => onTopic(e.target.value)} placeholder="For example: Birth anxiety" className="h-11 md:h-9" />
        </div>
      )}
    </div>
  );
}

function WriteBox({ memberId, partner, onSaved }: { memberId: string; partner?: Partner; onSaved: (e: DiaryEntry) => void }) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [onAgenda, setOnAgenda] = useState(false);
  const [topic, setTopic] = useState("");
  const [pending, startTransition] = useTransition();
  const agendaTopic = onAgenda ? topic.trim() : "";
  const ready = body.trim().length > 0 && (!onAgenda || agendaTopic.length > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    startTransition(async () => {
      const { data, error, response } = await api.POST("/members/{memberId}/diary-entries", {
        params: { path: { memberId } },
        body: { body: body.trim(), visibility, ...(agendaTopic ? { agendaTopic } : {}) },
      });
      if (error || !data) {
        toast.error("Could not save your entry. Please try again.");
        return;
      }
      if (isPreviewMock(response)) rememberMockEntry(memberId, data);
      toast.success(agendaTopic ? `Saved. "${agendaTopic}" is on your agenda.` : visibility === "private" ? "Saved. Only you can read it." : "Saved.");
      onSaved(data);
      setBody("");
      setTopic("");
      setOnAgenda(false);
      setVisibility("private");
    });
  }

  return (
    <form onSubmit={submit} aria-label="New entry" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <Textarea
        aria-label="Write an entry"
        rows={4}
        maxLength={4000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What is on your mind today?"
        className="min-h-24"
      />
      <Audience value={visibility} onChange={setVisibility} partner={partner} />
      <AgendaField on={onAgenda} onToggle={() => setOnAgenda((v) => !v)} topic={topic} onTopic={setTopic} id="new-topic" />
      <Button type="submit" size="lg" disabled={!ready || pending} className="h-11 sm:w-fit sm:px-6">
        {pending ? "Saving..." : "Save entry"}
      </Button>
    </form>
  );
}

function Entry({ memberId, entry, partner, mood, onChange }: { memberId: string; entry: DiaryEntry; partner?: Partner; mood?: number; onChange: (e: DiaryEntry) => void }) {
  const mine = entry.authorId === memberId;
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState(entry.visibility);
  const [onAgenda, setOnAgenda] = useState(Boolean(entry.agendaTopic));
  const [topic, setTopic] = useState(entry.agendaTopic ?? "");
  const [pending, startTransition] = useTransition();
  const Vis = visibilityIcon[entry.visibility];
  const Agenda = careIcon.agenda;
  const face = mood ? moodFace[mood] : undefined;
  const nextTopic = onAgenda ? topic.trim() : "";
  const dirty = visibility !== entry.visibility || nextTopic !== (entry.agendaTopic ?? "");

  function save() {
    startTransition(async () => {
      const { data, error, response } = await api.PATCH("/members/{memberId}/diary-entries/{entryId}", {
        params: { path: { memberId, entryId: entry.id } },
        // An empty string removes the topic; leaving it out would keep it.
        body: { visibility, agendaTopic: nextTopic },
      });
      if (error || !data) {
        toast.error("Could not update the entry. Please try again.");
        return;
      }
      // The API does not echo the topic when it is removed.
      const next = { ...entry, ...data, agendaTopic: data.agendaTopic || undefined };
      if (isPreviewMock(response)) rememberMockEntry(memberId, next);
      onChange(next);
      setOpen(false);
      toast.success(nextTopic ? `"${nextTopic}" is on your agenda.` : "Updated.");
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center gap-3">
        <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1 font-mono leading-tight tabular-nums">
          <span className="text-caption text-muted-foreground uppercase">{formatMonth(entry.writtenAt)}</span>
          <span className="text-title">{formatDayNumber(entry.writtenAt)}</span>
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {face && (
            <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground" title={`Mood that day: ${face.label}`}>
              <face.icon className="size-5 text-foreground" aria-hidden />
              <span className="sr-only">Mood that day: </span>
              {face.label}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
            <Vis className="size-3.5" aria-hidden />
            {mine ? visibilityLabel[entry.visibility] : `Shared by ${partner?.name ?? "your partner"}`}
          </span>
        </div>
      </header>
      <p className="mt-3 max-w-prose text-body whitespace-pre-line">{entry.body}</p>
      {entry.agendaTopic && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-status-up-soft px-3 py-1 text-caption font-medium text-status-up">
          <Agenda className="size-3.5" aria-hidden />
          On your agenda: {entry.agendaTopic}
        </p>
      )}
      {mine && (
        <div className="mt-3 border-t border-border pt-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ListPlus className="size-4" aria-hidden />
            Sharing and agenda
            <ChevronDown className={cn("size-4 transition-transform duration-150", open && "rotate-180")} aria-hidden />
          </button>
          {open && (
            <div className="mt-2 flex flex-col gap-4">
              <Audience value={visibility} onChange={setVisibility} partner={partner} compact />
              <AgendaField on={onAgenda} onToggle={() => setOnAgenda((v) => !v)} topic={topic} onTopic={setTopic} id={`topic-${entry.id}`} />
              <Button type="button" size="lg" disabled={!dirty || pending || (onAgenda && !nextTopic)} onClick={save} className="h-11 sm:w-fit sm:px-6">
                {pending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
