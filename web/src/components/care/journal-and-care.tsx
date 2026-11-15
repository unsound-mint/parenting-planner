"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { AgendaSuggestion, AgendaTopic, DiaryEntry, MoodCheckin, PsychologistAgenda, PsychologistSlots, SessionBrief, Visibility } from "@/lib/api/types";
import { formatDayNumber, formatMonth } from "@/lib/format";
import { Rise } from "@/components/joy/rise";
import { Composer } from "@/components/diary/composer";
import { EntryRow } from "@/components/diary/entry-row";
import { JournalArchive } from "@/components/diary/journal-archive";
import type { Partner } from "@/components/diary/audience";
import { topicKey, type Flights } from "./agenda-parts";
import { BriefCard } from "./brief-card";
import { MoodChart } from "@/components/diary/mood-chart";
import type { Mood } from "@/components/joy/mood-face";
import { shortName } from "./names";
import { SessionNoteCard } from "./session-note-card";

/**
 * The journal and the psychologist agenda in one client island, because a
 * topic travels between them: "Bring to" on an entry saves only a title on
 * that entry (PATCH diary-entries, agendaTopic) and the topic lands in the
 * agenda at once, flying from the field it was typed in. The server answer
 * then replaces the optimistic copy under the same key (the entry id), so
 * nothing remounts or replays.
 */
export function JournalAndCare({
  memberId,
  name,
  when,
  partner,
  starters,
  entries: serverEntries,
  entriesNext: serverNext,
  agenda,
  slots,
  brief,
  checkins,
  now,
}: {
  memberId: string;
  name: string;
  when: string;
  partner?: Partner;
  starters: string[];
  entries: DiaryEntry[];
  /** Cursor for the next page of entries, from GET diary-entries. */
  entriesNext?: string;
  agenda?: PsychologistAgenda;
  slots?: PsychologistSlots;
  brief?: SessionBrief;
  checkins: MoodCheckin[];
  /** The family's clock, ISO. */
  now: string;
}) {
  const router = useRouter();
  // Local copies so every change shows at once; a new server render resets them.
  const [src, setSrc] = useState({ serverEntries, agenda });
  const [entries, setEntries] = useState(serverEntries);
  const [topics, setTopics] = useState(agenda?.topics ?? []);
  const [suggestion, setSuggestion] = useState(agenda?.suggestions?.[0]);
  // Older pages and firsts loaded in the browser: kept across a server render, which
  // only brings the newest page back.
  const [cursor, setCursor] = useState(serverNext);
  const [firstsLoaded, setFirstsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  if (src.serverEntries !== serverEntries || src.agenda !== agenda) {
    setSrc({ serverEntries, agenda });
    const fresh = new Set(serverEntries.map((e) => e.id));
    const oldest = serverEntries.at(-1)?.writtenAt;
    const keep = entries.filter((e) => !fresh.has(e.id) && oldest && Date.parse(e.writtenAt) < Date.parse(oldest));
    setEntries([...serverEntries, ...keep]);
    setTopics(agenda?.topics ?? []);
    setSuggestion(agenda?.suggestions?.[0]);
  }
  const [busy, setBusy] = useState(0);
  const [flash, setFlash] = useState<string>();
  const flightFrom = useRef(new Map<string, DOMRect>());
  const fresh = useRef(new Set<string>());
  const flights: Flights = {
    take: (k) => {
      const r = flightFrom.current.get(k);
      flightFrom.current.delete(k);
      return r;
    },
    fresh: (k) => fresh.current.delete(k),
  };

  const psychologist = slots?.provider ?? agenda?.nextSession?.provider ?? agenda?.noteDue?.provider;
  const short = psychologist ? shortName(psychologist.name) : "your psychologist";
  const offerId = entries.find((e) => e.authorId === memberId && !e.agendaTopic)?.id;
  const byId = new Map(entries.map((e) => [e.id, e]));

  function flashEntry(id: string) {
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? undefined : f)), 1400);
  }

  async function patch(entry: DiaryEntry, body: { visibility: Visibility; agendaTopic?: string; body?: string; mood?: number }) {
    const { data, error } = await api.PATCH("/members/{memberId}/diary-entries/{entryId}", {
      params: { path: { memberId, entryId: entry.id } },
      body,
    });
    return error ? undefined : data;
  }

  async function changeVisibility(entry: DiaryEntry, visibility: Visibility): Promise<boolean> {
    const data = await patch(entry, { visibility });
    if (!data) {
      toast.error("Could not change who can read it. Nothing changed.");
      return false;
    }
    setEntries((cur) => cur.map((e) => (e.id === entry.id ? { ...e, visibility: data.visibility } : e)));
    toast.success(visibility === "private" ? "Only you can read it now." : `${partner?.name ?? "Your partner"} can read this entry now.`);
    return true;
  }

  async function edit(entry: DiaryEntry, text: string, mood: Mood | undefined): Promise<boolean> {
    const data = await patch(entry, { visibility: entry.visibility, body: text, ...(mood ? { mood } : {}) });
    if (!data) {
      toast.error("Could not save your changes. Your words are still in the box.");
      return false;
    }
    setEntries((cur) => cur.map((e) => (e.id === entry.id ? data : e)));
    flashEntry(entry.id);
    router.refresh();
    return true;
  }

  /** Merges a page from the server: the next older page, or every first (paged too). */
  async function more(q: { before?: string; first?: boolean }) {
    setLoading(true);
    let before = q.before;
    const got: DiaryEntry[] = [];
    for (;;) {
      const { data, error } = await api.GET("/members/{memberId}/diary-entries", {
        params: { path: { memberId }, query: { before, first: q.first, limit: 100 } },
      });
      if (error || !data) {
        setLoading(false);
        toast.error("Could not load older entries. Please try again.");
        return;
      }
      got.push(...data.items);
      before = data.nextBefore;
      // "Show older" reads one page; firsts are few, so read them all.
      if (!q.first || !before) break;
    }
    setEntries((cur) => {
      const have = new Set(cur.map((e) => e.id));
      return [...cur, ...got.filter((e) => !have.has(e.id))];
    });
    if (q.first) setFirstsLoaded(true);
    else setCursor(before);
    setLoading(false);
  }

  /** Marks or unmarks an old entry as a first, so the firsts can be corrected later. */
  async function markFirst(entry: DiaryEntry, first: boolean): Promise<boolean> {
    const { data, error } = await api.PATCH("/members/{memberId}/diary-entries/{entryId}", {
      params: { path: { memberId, entryId: entry.id } },
      body: { visibility: entry.visibility, first },
    });
    if (error || !data) {
      toast.error("Could not change it. Nothing changed.");
      return false;
    }
    setEntries((cur) => cur.map((e) => (e.id === entry.id ? { ...e, first: data.first } : e)));
    router.refresh();
    return true;
  }

  async function remove_(entry: DiaryEntry) {
    const undo = entries;
    const undoTopics = topics;
    setEntries((cur) => cur.filter((e) => e.id !== entry.id));
    setTopics((cur) => cur.filter((t) => t.diaryEntryId !== entry.id));
    const { error } = await api.DELETE("/members/{memberId}/diary-entries/{entryId}", { params: { path: { memberId, entryId: entry.id } } });
    if (error) {
      setEntries(undo);
      setTopics(undoTopics);
      toast.error("Could not delete the entry. Please try again.");
      return;
    }
    toast.success("Entry deleted.");
    router.refresh();
  }

  function jump(id: string) {
    flashEntry(id);
  }

  /** Puts a title on an entry's agenda. from: the field's rect for the flight; none means drop in. */
  async function bring(entry: DiaryEntry, title: string, from?: DOMRect): Promise<boolean> {
    const local: AgendaTopic = { id: `local-${entry.id}`, text: title, addedAt: entry.writtenAt, diaryEntryId: entry.id };
    if (from) flightFrom.current.set(entry.id, from);
    else fresh.current.add(entry.id);
    setTopics((cur) => [...cur.filter((t) => topicKey(t) !== entry.id), local]);
    setEntries((cur) => cur.map((e) => (e.id === entry.id ? { ...e, agendaTopic: title } : e)));
    flashEntry(entry.id);
    setBusy((n) => n + 1);
    const data = await patch(entry, { visibility: entry.visibility, agendaTopic: title });
    setBusy((n) => n - 1);
    if (!data) {
      setTopics((cur) => cur.filter((t) => t.id !== local.id));
      setEntries((cur) => cur.map((e) => (e.id === entry.id ? { ...e, agendaTopic: entry.agendaTopic } : e)));
      toast.error("Could not add the topic. Please try again.");
      return false;
    }
    // On a phone the agenda is below the list: say where it went.
    const agendaEl = document.getElementById("agenda-title");
    const r = agendaEl?.getBoundingClientRect();
    if (r && (r.top > window.innerHeight || r.bottom < 0)) {
      toast.success(`In your brief for ${short}`, { action: { label: "See it", onClick: () => agendaEl?.scrollIntoView({ behavior: "smooth", block: "center" }) } });
    }
    router.refresh();
    return true;
  }

  function addSuggestion(s: AgendaSuggestion) {
    const entry = byId.get(s.diaryEntryId);
    if (!entry) return;
    setSuggestion(undefined);
    void bring(entry, s.text).then((ok) => !ok && setSuggestion(s));
  }

  async function saveOrder(next: AgendaTopic[], undo: AgendaTopic[]) {
    setTopics(next);
    setBusy((n) => n + 1);
    const { error } = await api.PUT("/members/{memberId}/psychologist-agenda", {
      params: { path: { memberId } },
      body: { topicIds: next.map((t) => t.id) },
    });
    setBusy((n) => n - 1);
    if (error) {
      setTopics(undo);
      toast.error("Could not save your agenda. Please try again.");
      return;
    }
    router.refresh();
  }

  async function remove(t: AgendaTopic) {
    const entry = t.diaryEntryId ? byId.get(t.diaryEntryId) : undefined;
    if (!entry) return saveOrder(topics.filter((x) => x.id !== t.id), topics);
    // A journal topic is removed on its entry, so "Bring to" comes back there.
    const undo = topics;
    setTopics((cur) => cur.filter((x) => x.id !== t.id));
    setEntries((cur) => cur.map((e) => (e.id === entry.id ? { ...e, agendaTopic: undefined } : e)));
    setBusy((n) => n + 1);
    const data = await patch(entry, { visibility: entry.visibility, agendaTopic: "" });
    setBusy((n) => n - 1);
    if (!data) {
      setTopics(undo);
      setEntries((cur) => cur.map((e) => (e.id === entry.id ? entry : e)));
      toast.error("Could not remove the topic. Please try again.");
      return;
    }
    router.refresh();
  }

  const origin = (t: AgendaTopic) => {
    if (!t.diaryEntryId) return { label: "From your check-ins" };
    const e = byId.get(t.diaryEntryId);
    const at = e?.writtenAt ?? t.addedAt;
    return { label: `From your journal, ${formatMonth(at)} ${formatDayNumber(at)}`, href: e ? `#entry-${e.id}` : undefined };
  };

  return (
    <div className="grid min-w-0 items-start gap-6 @5xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] @5xl:gap-7">
      <Rise i={1} className="flex min-w-0 flex-col gap-3">
        <Composer
          memberId={memberId}
          name={name}
          when={when}
          partner={partner}
          starters={starters}
          onSaved={(e) => {
            setEntries((cur) => [e, ...cur]);
            router.refresh();
          }}
        />

        <MoodChart memberId={memberId} now={now} entries={entries} checkins={checkins} onJump={jump} />

        {entries.length === 0 ? (
          <p className="mt-3 flex items-center gap-3 rounded-3xl border border-dashed border-line-2 px-5 py-4 text-label font-normal text-ink-2">
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Your entries gather here, newest first. Each one stays yours until you share it.
          </p>
        ) : (
          <JournalArchive
            memberId={memberId}
            entries={entries}
            nextBefore={cursor}
            firstsLoaded={firstsLoaded}
            loading={loading}
            onOlder={() => void more({ before: cursor })}
            onFirsts={() => void more({ first: true })}
            onJump={(id) => {
              document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              flashEntry(id);
            }}
            row={(e) => (
              <EntryRow
                entry={e}
                mine={e.authorId === memberId}
                partner={partner}
                psychologist={short}
                flash={flash === e.id}
                offer={e.id === offerId}
                onVisibility={(v) => changeVisibility(e, v)}
                onBring={(title, from) => bring(e, title, from)}
                onEdit={e.authorId === memberId ? (text, mood) => edit(e, text, mood) : undefined}
                onFirst={e.authorId === memberId ? (first) => markFirst(e, first) : undefined}
                onDelete={e.authorId === memberId ? () => remove_(e) : undefined}
              />
            )}
          />
        )}
      </Rise>

      <Rise i={2} className="flex min-w-0 flex-col gap-6">
        {agenda ? (
          <BriefCard
            memberId={memberId}
            psychologist={psychologist}
            topics={topics}
            origin={origin}
            suggestion={suggestion}
            lastSession={agenda.noteDue}
            slots={slots?.items ?? []}
            brief={brief}
            now={now}
            busy={busy > 0}
            flights={flights}
            onAddSuggestion={addSuggestion}
            onRemove={remove}
            onReorder={(next) => saveOrder(next, topics)}
          />
        ) : (
          <p role="status" className="rounded-3xl border border-line bg-card p-6 text-label text-muted-foreground">
            Your agenda is not loading right now. Your entries are safe; try again in a moment.
          </p>
        )}
        {agenda?.noteDue && <SessionNoteCard memberId={memberId} booking={agenda.noteDue} />}
      </Rise>
    </div>
  );
}
