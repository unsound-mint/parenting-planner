"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { toast } from "sonner";
import { CalendarPlus, ChevronDown, Download, EyeOff, Lock, Trash2, X } from "lucide-react";
import { api, isPreviewMock } from "@/lib/api/client";
import type { CalendarEvent, CalendarVisibility, Stage } from "@/lib/api/types";
import { dayKey } from "@/lib/format";
import { easternClock, easternInstant, isStoredKind, storedKinds, type StoredKind } from "@/lib/schedule";
import { calendarKindIcon, calendarKindLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { eventIcsHref, googleEventHref } from "@/components/care/ics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Guest = { id: string; name: string; /** A parent sees every family event, so they are always part of a shared one. */ parent: boolean };

// What each kind asks for. The placeholder matches the kind, a reminder has no end or place,
// and only a health visit starts private and neutral (issue 99, 38): the owner has to widen it.
const kindForm: Record<StoredKind, { label: string; placeholder: string; where: string | null; range: boolean; privateByDefault: boolean }> = {
  appointment: { label: "Visit", placeholder: "Prenatal checkup", where: "Clinic or address", range: true, privateByDefault: true },
  class: { label: "Class name", placeholder: "Childbirth class", where: "Where it takes place", range: true, privateByDefault: false },
  reminder: { label: "Remind me to", placeholder: "Pack the hospital bag", where: null, range: false, privateByDefault: true },
  other: { label: "Event", placeholder: "Lunch with the grandparents", where: "Where", range: true, privateByDefault: false },
};

/** The visit example follows the family's stage: no "prenatal" for a family with a newborn. */
const visitExample = (stage?: Stage): string => {
  switch (stage) {
    case "planning":
    case "trying":
      return "Preconception visit";
    case "pregnancy":
      return "Prenatal checkup";
    case "postpartum":
    case "infant":
      return "Well-baby checkup";
    case "toddler":
      return "Pediatrician visit";
    case "preschool":
    case "school_age":
      return "Dentist visit";
    default:
      return "Doctor visit";
  }
};

// Create (no event) or edit (event) one stored calendar event. The trigger is
// whatever the caller passes, so an event card can be the button.
export function EventDialog({
  memberId,
  guests,
  event,
  today,
  feedActive,
  stage,
  children,
  triggerClassName,
}: {
  memberId: string;
  guests: Guest[];
  event?: CalendarEvent;
  today: string;
  /** The person has a calendar link: only then does hiding details matter. */
  feedActive: boolean;
  stage?: Stage;
  children: ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const parents = guests.filter((g) => g.parent).map((g) => g.id);
  const shareDefault = (k: StoredKind) => (kindForm[k].privateByDefault ? new Set<string>() : new Set(parents));
  const init = () => {
    const kind: StoredKind = event && isStoredKind(event.kind) ? event.kind : "appointment";
    // A family event reaches every parent already, so they show as chosen when it is opened.
    const people = event ? new Set([...event.attendeeIds.filter((id) => id !== memberId), ...(event.visibility === "family" ? parents : [])]) : shareDefault(kind);
    return {
      kind,
      title: event?.title ?? "",
      date: event ? (event.allDay ? event.startsAt.slice(0, 10) : dayKey(event.startsAt)) : today,
      allDay: event?.allDay ?? false,
      start: event && !event.allDay ? easternClock(event.startsAt) : "09:00",
      end: event?.endsAt && !event.allDay ? easternClock(event.endsAt) : "10:00",
      location: event?.location ?? "",
      people,
      neutral: event?.neutralTitle ?? kind === "appointment",
    };
  };
  const [f, setF] = useState(init);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setF((c) => ({ ...c, [k]: v }));
  const editing = !!event;
  const form = { ...kindForm[f.kind], ...(f.kind === "appointment" ? { placeholder: visitExample(stage) } : {}) };
  const shared = f.people.size > 0;
  const visibility: CalendarVisibility = shared ? "family" : "private";
  const hasRange = form.range && !f.allDay;
  const titleBad = !f.title.trim();
  const endBad = hasRange && f.end <= f.start;
  const dateBad = !f.date;

  function pickKind(kind: StoredKind) {
    // New events follow the kind's defaults; an edited event keeps what its owner chose.
    setF((c) => (editing ? { ...c, kind } : { ...c, kind, people: shareDefault(kind), neutral: kind === "appointment" }));
  }

  function toggle(id: string) {
    setF((c) => {
      const next = new Set(c.people);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...c, people: next };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (titleBad || endBad || dateBad) return;
    const startsAt = f.allDay ? `${f.date}T00:00:00Z` : easternInstant(f.date, f.start);
    const endsAt = hasRange ? easternInstant(f.date, f.end) : undefined;
    const attendeeIds = [...f.people];
    const location = form.where ? f.location.trim() : "";
    startTransition(async () => {
      const common = { title: f.title.trim(), startsAt, allDay: f.allDay, location, attendeeIds, visibility, neutralTitle: f.neutral };
      const res = event
        ? await api.PATCH("/members/{memberId}/calendar-events/{eventId}", {
            params: { path: { memberId, eventId: event.id } },
            body: { ...common, ...(endsAt ? { endsAt } : {}) },
          })
        : await api.POST("/members/{memberId}/calendar-events", {
            params: { path: { memberId } },
            body: { ...common, kind: f.kind, location: location || undefined, ...(endsAt ? { endsAt } : {}) },
          });
      if (res.error || !res.data) {
        toast.error(res.error?.message ?? "Could not save the event. Please try again.");
        return;
      }
      setOpen(false);
      if (isPreviewMock(res.response)) toast("Preview only", { description: "The calendar is not connected yet, so nothing was saved." });
      else toast.success(editing ? "Event updated." : "Event added.");
      router.refresh();
    });
  }

  function remove() {
    if (!event) return;
    startTransition(async () => {
      const res = await api.DELETE("/members/{memberId}/calendar-events/{eventId}", { params: { path: { memberId, eventId: event.id } } });
      if (!res.response.ok) {
        toast.error("Could not delete the event. Please try again.");
        return;
      }
      setOpen(false);
      if (isPreviewMock(res.response)) toast("Preview only", { description: "The calendar is not connected yet, so nothing was deleted." });
      else toast.success("Event deleted.");
      router.refresh();
    });
  }

  // The exported copy follows the same privacy choice as the calendar link.
  const exported = event && {
    id: event.id,
    title: event.neutralTitle ? calendarKindLabel[event.kind] : event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    location: event.neutralTitle ? undefined : event.location,
  };

  const names = guests.filter((g) => f.people.has(g.id)).map((g) => g.name);
  const summary = !shared
    ? "Only you see this."
    : `Shared with ${names.join(", ")}.${names.length > 0 && !guests.some((g) => g.parent && f.people.has(g.id)) ? " Your partner sees it too." : ""}`;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setF(init());
          setTried(false);
          setConfirmDelete(false);
        }
        setOpen(o);
      }}
    >
      <Dialog.Trigger className={triggerClassName}>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border-t border-border bg-popover text-popover-foreground shadow-lg outline-none transition-transform duration-300 ease-out data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[90dvh] md:w-[34rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:transition-opacity md:data-[ending-style]:translate-y-0 md:data-[ending-style]:opacity-0 md:data-[starting-style]:translate-y-0 md:data-[starting-style]:opacity-0">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <Dialog.Title className="flex-1 text-title">{editing ? "Edit event" : "Add an event"}</Dialog.Title>
            <Dialog.Close aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9">
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          <form noValidate onSubmit={submit} className="flex flex-col gap-5 overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div role="radiogroup" aria-label="Type" className="grid grid-cols-4 gap-1.5">
              {storedKinds.map((k) => {
                const Icon = calendarKindIcon[k];
                const on = f.kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={editing && !on}
                    onClick={() => pickKind(k)}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-caption outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
                      on ? "border-primary bg-secondary font-semibold text-secondary-foreground" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                    {calendarKindLabel[k]}
                  </button>
                );
              })}
            </div>

            <Field id="ev-title" label={form.label} error={tried && titleBad ? "Give it a name." : undefined}>
              <Input id="ev-title" maxLength={120} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={form.placeholder} aria-invalid={tried && titleBad} className="h-11 text-base" />
            </Field>

            <div className="flex flex-col gap-3">
              <div className={cn("grid gap-3", form.range ? "grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr]" : "grid-cols-2")}>
                <div className={cn("flex flex-col gap-1.5", form.range && "col-span-2 sm:col-span-1")}>
                  <Label htmlFor="ev-date">Day</Label>
                  <Input id="ev-date" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} aria-invalid={tried && dateBad} className="h-11 font-mono" />
                </div>
                {!f.allDay && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ev-start">{form.range ? "From" : "At"}</Label>
                    <Input id="ev-start" type="time" value={f.start} onChange={(e) => set("start", e.target.value)} className="h-11 font-mono" />
                  </div>
                )}
                {hasRange && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ev-end">To</Label>
                    <Input id="ev-end" type="time" value={f.end} onChange={(e) => set("end", e.target.value)} aria-invalid={tried && endBad} className="h-11 font-mono" />
                  </div>
                )}
              </div>
              {tried && endBad && <p role="alert" className="text-caption text-status-late">It has to end after it starts.</p>}
              <ToggleRow id="ev-allday" label="All day" checked={f.allDay} onChange={(v) => set("allDay", v)} />
            </div>

            {form.where && (
              <Field id="ev-loc" label="Where">
                <Input id="ev-loc" maxLength={200} value={f.location} onChange={(e) => set("location", e.target.value)} placeholder={form.where} className="h-11 text-base" />
              </Field>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label font-medium">Who is it for</legend>
              <ul className="flex flex-wrap gap-2">
                <li>
                  <PersonChip on={!shared} onClick={() => set("people", new Set())} icon={Lock}>
                    Only me
                  </PersonChip>
                </li>
                {guests.map((g) => (
                  <li key={g.id}>
                    <PersonChip on={f.people.has(g.id)} onClick={() => toggle(g.id)}>
                      {g.name}
                    </PersonChip>
                  </li>
                ))}
              </ul>
              <p aria-live="polite" className="text-caption text-muted-foreground">
                {summary}
              </p>
            </fieldset>

            {feedActive && (
              <details className="group rounded-xl border border-border px-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-label font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  <EyeOff aria-hidden className="size-4 text-muted-foreground" />
                  <span className="flex-1">Privacy in synced calendars</span>
                  <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-1 pb-3">
                  <ToggleRow id="ev-neutral" label="Hide details in synced calendars" checked={f.neutral} onChange={(v) => set("neutral", v)} />
                  <p className="text-caption text-muted-foreground">
                    Your calendar link and downloaded files show &ldquo;{calendarKindLabel[f.kind]}&rdquo; with no title or place. Here you still see everything.
                  </p>
                </div>
              </details>
            )}

            <Button type="submit" size="lg" disabled={pending} className="h-12 text-body font-semibold">
              {editing ? "Save changes" : "Add to calendar"}
            </Button>

            {exported && (
              <div className="flex flex-col gap-1 border-t border-border pt-3">
                <p className="text-caption text-muted-foreground">Want it in your own calendar right now?</p>
                <div className="flex flex-wrap gap-2">
                  <a href={googleEventHref(exported)} target="_blank" rel="noopener" className={linkButton}>
                    <CalendarPlus aria-hidden className="size-4" />
                    Add to Google Calendar
                  </a>
                  <a href={eventIcsHref(exported)} download="event.ics" className={linkButton}>
                    <Download aria-hidden className="size-4" />
                    Download .ics
                  </a>
                </div>
              </div>
            )}

            {editing && (
              <div className="flex items-center gap-2">
                {confirmDelete ? (
                  <>
                    <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
                      <Trash2 aria-hidden className="size-4" />
                      Yes, delete it
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                      Keep it
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-status-late">
                    <Trash2 aria-hidden className="size-4" />
                    Delete event
                  </Button>
                )}
              </div>
            )}
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const linkButton =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 text-label font-medium text-secondary-foreground outline-none transition-colors duration-150 hover:bg-secondary/70 focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-caption text-status-late">
          {error}
        </p>
      )}
    </div>
  );
}

function PersonChip({ on, onClick, icon: Icon, children }: { on: boolean; onClick: () => void; icon?: typeof Lock; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-label outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {Icon && <Icon aria-hidden className="size-4" />}
      {children}
    </button>
  );
}

function ToggleRow({ id, label, checked, onChange, icon: Icon }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; icon?: typeof Lock }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      {Icon && <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
      <span id={id} className="flex-1 text-label font-medium">
        {label}
      </span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={id}
        className="relative flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-primary"
      >
        <Switch.Thumb className="size-6 rounded-full bg-card shadow-sm transition-transform duration-150 ease-(--ease-out) data-[checked]:translate-x-5" />
      </Switch.Root>
    </div>
  );
}
