"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { toast } from "sonner";
import { EyeOff, Lock, Users, X } from "lucide-react";
import { api, isPreviewMock } from "@/lib/api/client";
import type { CalendarEvent, CalendarVisibility } from "@/lib/api/types";
import { dayKey } from "@/lib/format";
import { easternClock, easternInstant, isStoredKind, storedKinds, type StoredKind } from "@/lib/schedule";
import { calendarKindIcon, calendarKindLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Guest = { id: string; name: string };

// Health visits start private and neutral (issue 99, 38): the owner has to choose to widen them.
const defaultsFor = (k: StoredKind): { visibility: CalendarVisibility; neutral: boolean } =>
  k === "appointment" ? { visibility: "private", neutral: true } : { visibility: "family", neutral: false };

const visibilityOptions: { value: CalendarVisibility; name: string; hint: string; icon: typeof Lock }[] = [
  { value: "private", name: "Only me", hint: "Nobody else sees it", icon: Lock },
  { value: "family", name: "Family", hint: "Your partner and guests see it", icon: Users },
];

// Create (no event) or edit (event) one stored calendar event. The trigger is
// whatever the caller passes, so an event card can be the button.
export function EventDialog({
  memberId,
  guests,
  event,
  today,
  children,
  triggerClassName,
}: {
  memberId: string;
  guests: Guest[];
  event?: CalendarEvent;
  today: string;
  children: ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const init = () => {
    const kind: StoredKind = event && isStoredKind(event.kind) ? event.kind : "appointment";
    const d = defaultsFor(kind);
    return {
      kind,
      title: event?.title ?? "",
      date: event ? (event.allDay ? event.startsAt.slice(0, 10) : dayKey(event.startsAt)) : today,
      allDay: event?.allDay ?? false,
      start: event && !event.allDay ? easternClock(event.startsAt) : "09:00",
      end: event?.endsAt && !event.allDay ? easternClock(event.endsAt) : "10:00",
      location: event?.location ?? "",
      guestIds: new Set(event?.attendeeIds.filter((id) => id !== memberId) ?? []),
      visibility: event?.visibility ?? d.visibility,
      neutral: event?.neutralTitle ?? d.neutral,
    };
  };
  const [f, setF] = useState(init);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setF((c) => ({ ...c, [k]: v }));
  const editing = !!event;
  const kindName = calendarKindLabel[f.kind];

  function pickKind(kind: StoredKind) {
    // New events follow the kind's defaults; an edited event keeps what its owner chose.
    setF((c) => (editing ? { ...c, kind } : { ...c, kind, ...{ visibility: defaultsFor(kind).visibility, neutral: defaultsFor(kind).neutral } }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const timed = !f.allDay;
    const startsAt = timed ? easternInstant(f.date, f.start) : `${f.date}T00:00:00Z`;
    const endsAt = timed && f.end > f.start ? easternInstant(f.date, f.end) : undefined;
    const attendeeIds = f.visibility === "private" ? [] : [...f.guestIds];
    startTransition(async () => {
      const common = { title: f.title.trim(), startsAt, allDay: f.allDay, location: f.location.trim(), attendeeIds, visibility: f.visibility, neutralTitle: f.neutral };
      const res = event
        ? await api.PATCH("/members/{memberId}/calendar-events/{eventId}", {
            params: { path: { memberId, eventId: event.id } },
            body: { ...common, ...(endsAt ? { endsAt } : {}) },
          })
        : await api.POST("/members/{memberId}/calendar-events", {
            params: { path: { memberId } },
            body: { ...common, kind: f.kind, location: f.location.trim() || undefined, ...(endsAt ? { endsAt } : {}) },
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

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) setF(init());
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
          <form onSubmit={submit} className="flex flex-col gap-5 overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div role="radiogroup" aria-label="Kind" className="grid grid-cols-4 gap-1.5">
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-title">What</Label>
              <Input id="ev-title" required maxLength={120} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Prenatal visit" className="h-11 text-base" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
              <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="ev-date">Day</Label>
                <Input id="ev-date" type="date" required value={f.date} onChange={(e) => set("date", e.target.value)} className="h-11 font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev-start">From</Label>
                <Input id="ev-start" type="time" disabled={f.allDay} value={f.start} onChange={(e) => set("start", e.target.value)} className="h-11 font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev-end">To</Label>
                <Input id="ev-end" type="time" disabled={f.allDay} value={f.end} onChange={(e) => set("end", e.target.value)} className="h-11 font-mono" />
              </div>
            </div>
            <ToggleRow id="ev-allday" label="All day" checked={f.allDay} onChange={(v) => set("allDay", v)} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-loc">Where</Label>
              <Input id="ev-loc" maxLength={200} value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Optional" className="h-11 text-base" />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label font-medium">Who can see it</legend>
              <div role="radiogroup" aria-label="Who can see it" className="grid grid-cols-2 gap-2">
                {visibilityOptions.map(({ value, name, hint, icon: Icon }) => {
                  const on = f.visibility === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set("visibility", value)}
                      className={cn(
                        "flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
                        on ? "border-primary bg-secondary" : "border-border hover:bg-muted",
                      )}
                    >
                      <Icon aria-hidden className={cn("size-5 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
                      <span className="min-w-0">
                        <span className="block text-label font-semibold">{name}</span>
                        <span className="block text-caption text-muted-foreground">{hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {f.visibility === "family" && guests.length > 0 && (
                <ul aria-label="Guests" className="flex flex-wrap gap-2 pt-1">
                  {guests.map((g) => {
                    const on = f.guestIds.has(g.id);
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setF((c) => {
                              const next = new Set(c.guestIds);
                              if (on) next.delete(g.id);
                              else next.add(g.id);
                              return { ...c, guestIds: next };
                            })
                          }
                          className={cn(
                            "min-h-11 rounded-full border px-4 text-label outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {on ? `${g.name} comes` : `Invite ${g.name}`}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>

            <div className="flex flex-col gap-1">
              <ToggleRow id="ev-neutral" icon={EyeOff} label={`Other calendars show only "${kindName}"`} checked={f.neutral} onChange={(v) => set("neutral", v)} />
              <p className="text-caption text-muted-foreground">Applies to the calendar link and exported files. Here you still see the title.</p>
            </div>

            <Button type="submit" size="lg" disabled={pending || !f.title.trim()} className="h-12 text-body font-semibold">
              {editing ? "Save changes" : "Add to calendar"}
            </Button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
