import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, CloudOff, Lock } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import type { CalendarEvent, CalendarScope } from "@/lib/api/types";
import { countThings, daysUntilInstant, formatClock, formatShortDate, whenWords } from "@/lib/format";
import { familyPeople, isCaregiver, type Role } from "@/lib/roles";
import { roleAccent } from "@/lib/visuals";
import { addDays, todayKey } from "@/lib/schedule";
import { OTHER_PARENT } from "@/lib/mock/fixtures/schedule";
import { ScopeTabs } from "@/components/schedule/scope-tabs";
import { ShiftCard } from "@/components/schedule/shift-card";
import { WeekView, type Owner } from "@/components/schedule/week-view";
import { cn } from "@/lib/utils";

// The next seven days for one person, their partner or the whole family.
// Events come from one feed (shifts, appointments, task due dates); nothing here is stored in the UI.
export default function CalendarPage({ params, searchParams }: PageProps<"/family/[memberId]/calendar">) {
  return (
    <Suspense fallback={<CalendarFallback />}>
      <Calendar params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const scopes: CalendarScope[] = ["mine", "partner", "family"];
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

async function Calendar({
  params,
  searchParams,
}: {
  params: PageProps<"/family/[memberId]/calendar">["params"];
  searchParams: PageProps<"/family/[memberId]/calendar">["searchParams"];
}) {
  const { memberId } = await params;
  const query = await searchParams;
  const rawScope = typeof query.scope === "string" ? query.scope : "";

  const api = await serverApi();
  // After serverApi(): "today" is request time, so it must come after the request is dynamic.
  const today = todayKey();
  const from = typeof query.from === "string" && isoDate.test(query.from) ? query.from : today;
  const path = { params: { path: { memberId } } };
  const { data: family } = await api.GET("/family");
  const people = family ? familyPeople(family) : [];
  const me = people.find((p) => p.id === memberId);
  if (!family || !me) notFound();

  const caregiver = isCaregiver(me.role);
  const scope: CalendarScope = caregiver ? "mine" : scopes.find((s) => s === rawScope) ?? "family";
  const [events, shifts] = await Promise.all([
    api.GET("/members/{memberId}/calendar-events", {
      params: { ...path.params, query: { scope, from, to: addDays(from, 6) } },
    }),
    api.GET("/members/{memberId}/shifts", path),
  ]);

  // Not built yet, or not shared with this person: the nav hides it, so a direct visit gets the same.
  if (events.response.status === 501 || events.response.status === 404) notFound();
  if (events.response.status === 403) return <NotShared name={me.displayName} />;

  const owners: Record<string, Owner> = Object.fromEntries(
    people.map((p) => [p.id, { name: p.displayName, role: p.role }]),
  );
  // Preview mocks cannot see the family; they name the other parent with this key (lib/mock/fixtures/schedule.ts).
  const other = family.parents.find((p) => p.id !== memberId);
  if (other) owners[OTHER_PARENT] = { name: other.displayName, role: other.role };
  const items = events.data?.items ?? [];
  const agreed = (shifts.data?.items ?? []).filter((s) => s.status === "agreed");
  const hrefFor = (s: CalendarScope) => `/family/${memberId}/calendar?scope=${s}${from === today ? "" : `&from=${from}`}`;
  const weekHref = (f: string) => `/family/${memberId}/calendar?scope=${scope}${f === today ? "" : `&from=${f}`}`;

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-16 md:px-8">
      <header>
        <h1 className="max-w-2xl text-headline text-balance">{headline(items, from === today, caregiver)}</h1>
        {caregiver ? (
          <p className="mt-2 text-label font-normal text-muted-foreground">Your shifts only</p>
        ) : (
          <Legend people={people.filter((p) => !isCaregiver(p.role) || items.some((e) => e.ownerId === p.id))} />
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {!caregiver && <ScopeTabs active={scope} hrefFor={hrefFor} />}
        <span className="flex-1" />
        <div className="flex items-center gap-1">
          <WeekLink href={weekHref(addDays(from, -7))} label="Previous week" icon={ChevronLeft} />
          <span className="min-w-36 text-center font-mono text-label">
            {formatShortDate(from)} to {formatShortDate(addDays(from, 6))}
          </span>
          <WeekLink href={weekHref(addDays(from, 7))} label="Next week" icon={ChevronRight} />
        </div>
        {from !== today && (
          <Link
            href={weekHref(today)}
            replace
            className="flex min-h-11 items-center rounded-full px-3 text-label text-primary hover:bg-secondary md:min-h-9"
          >
            Today
          </Link>
        )}
      </div>

      {events.data ? (
        <WeekView from={from} today={today} events={items} owners={owners} />
      ) : (
        <Unavailable />
      )}

      {agreed.length > 0 && (
        <section aria-labelledby="agreed-title" className="flex flex-col gap-3">
          <div>
            <h2 id="agreed-title" className="text-title">
              Agreed, starts when the baby is home
            </h2>
            <p className="text-label font-normal text-muted-foreground">These move into the week above on the day you switch.</p>
          </div>
          <ul className="grid max-w-3xl gap-3">
            {agreed.map((s) => (
              <li key={s.id}>
                <ShiftCard shift={s} owner={owners[s.memberId]} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** One status sentence: the next thing, or how full the week is. */
function headline(events: CalendarEvent[], thisWeek: boolean, caregiver: boolean): string {
  if (events.length === 0) return caregiver ? "No shifts this week." : "Nothing is scheduled this week.";
  if (!thisWeek) return `${countThings(events.length)} on this week.`;
  const now = Date.now();
  const next = events.find((e) => Date.parse(e.endsAt ?? e.startsAt) >= now || e.allDay);
  if (!next) return `${countThings(events.length)} this week, all done so far.`;
  const when = whenWords(daysUntilInstant(next.startsAt));
  const at = next.allDay ? "" : ` at ${formatClock(next.startsAt)}`;
  return `Next: ${next.title}, ${when}${at}.`;
}

/** The key to the colours: one dot and name per person, and the neutral one for shared events. */
function Legend({ people }: { people: { id: string; role: Role; displayName: string }[] }) {
  return (
    <ul aria-label="Colour key" className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-label font-normal text-muted-foreground">
      {people.map((p) => (
        <li key={p.id} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-full", roleAccent[p.role].bg)} />
          {p.displayName}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-full bg-border" />
        Shared
      </li>
    </ul>
  );
}

function WeekLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof ChevronLeft }) {
  return (
    <Link
      href={href}
      replace
      aria-label={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground md:size-9",
      )}
    >
      <Icon className="size-5" aria-hidden />
    </Link>
  );
}

function NotShared({ name }: { name: string }) {
  return (
    <main className="px-4 pt-6 md:px-8">
      <div role="status" className="flex max-w-xl items-center gap-4 rounded-2xl border border-border bg-card p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-title">The schedule is not shared with you, {name}</p>
          <p className="text-label text-muted-foreground">Ask a parent to share it with you.</p>
        </div>
      </div>
    </main>
  );
}

function Unavailable() {
  return (
    <div role="status" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CloudOff className="size-6" aria-hidden />
      </span>
      <div>
        <p className="text-title">The calendar is not loading</p>
        <p className="text-label text-muted-foreground">Nothing is lost. Try again in a moment.</p>
      </div>
    </div>
  );
}

function CalendarFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-11 w-80 animate-pulse rounded-full bg-muted" />
      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
