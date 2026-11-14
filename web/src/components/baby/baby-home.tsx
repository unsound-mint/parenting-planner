import { notFound, redirect } from "next/navigation";
import { Handshake, Hourglass } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import type { CareLogEntry, CareLogKind, CareSummary, Family, Guide, Handoff, PregnancyWeek, Today, VoiceNote } from "@/lib/api/types";
import { agoWords, breastSide, durationWords, isAsleep, lastActivityAt } from "@/lib/care";
import { childCalled, familyContext, formatClock, givenName } from "@/lib/format";
import { allows, familyPeople, isCaregiver, type Person } from "@/lib/roles";
import { careLogIcon, careLogLabel, careLogTint, diaperLabel, feedMethodLabel, roleAccent, roleLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { AllergyChips, AllergyLabel, BabyCard } from "@/components/baby/baby-card";
import { MilestoneCard } from "@/components/child/milestone-card";
import { FeedLogger, QuickAdd, SleepLogger, WhenPicker, WhenProvider, type QuickAction } from "@/components/baby/care-logger";
import { CareChart } from "@/components/baby/care-chart";
import { AcceptHandoff, HandoffForm } from "@/components/baby/handoff-actions";
import { VoicePlayer } from "@/components/baby/voice-player";
import { previewMocksEnabled } from "@/lib/mock/registry";
import { CaregiverHome } from "@/components/week/caregiver-home";
import { PageFrame } from "@/components/shell/page";
import { PortraitFlipbook } from "@/components/portrait";
import { CaregiverTodaySlot, GuidesSlot, WeekCardSlot, type Pending } from "@/components/today/slots";

const diaperActions: QuickAction[] = [
  { kind: "diaper", label: "Wet", diaper: "wet" },
  { kind: "diaper", label: "Dirty", diaper: "dirty" },
  { kind: "diaper", label: "Both", diaper: "both" },
];

/**
 * The baby's day for anyone who takes care of the baby: last feed, sleep and
 * diaper, today as a timeline, one-tap logging, the handoff and the baby card.
 * Parents open it as "Baby"; a grandparent or nanny gets it as their home.
 * Each part draws only what its endpoint returned and what the permissions allow.
 */
export type CaregiverSlots = {
  today?: Pending<Today>;
  guides?: Pending<{ items: Guide[] }>;
  card?: Pending<PregnancyWeek>;
};

export async function BabyHome({ memberId, family, slots }: { memberId: string; family: Family; slots?: CaregiverSlots }) {
  const people = familyPeople(family);
  const me = people.find((p) => p.id === memberId);
  if (!me) notFound();
  const caregiver = family.caregivers?.find((c) => c.id === memberId);
  const child = family.children[0];
  const canLog = allows({ role: me.role, permissions: caregiver?.permissions }, "care_log");
  const canCard = allows({ role: me.role, permissions: caregiver?.permissions }, "baby_passport");
  const fallback = () => (caregiver ? <CaregiverHome family={family} caregiver={caregiver} {...slots} /> : notFound());
  if (!child) return fallback();

  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const parent = !isCaregiver(me.role);
  const [log, handoffs, passport, voiceProbe, milestones] = await Promise.all([
    // A week, for the chart's 7-day view; the 24-hour view is the end of it.
    canLog ? api.GET("/members/{memberId}/care-log", { params: { path: { memberId }, query: { days: 7 } } }) : undefined,
    canLog ? api.GET("/members/{memberId}/handoffs", path) : undefined,
    canCard ? api.GET("/members/{memberId}/children/{childId}/passport", { params: { path: { memberId, childId: child.id } } }) : undefined,
    // Probe: a read of a note that cannot exist is 404 once voice notes work and 501 before.
    // Preview mocks cover the upload but not audio, so in preview the recorder stays on.
    canLog ? api.GET("/members/{memberId}/voice-notes/{voiceNoteId}", { params: { path: { memberId, voiceNoteId: NO_NOTE } }, parseAs: "stream" }) : undefined,
    // The CDC checklist the baby is heading to (2, 4, 6, 9 or 12 months); parents only, like the API.
    parent ? api.GET("/members/{memberId}/children/{childId}/milestones", { params: { path: { memberId, childId: child.id } } }) : undefined,
  ]);
  const voice = previewMocksEnabled || (voiceProbe !== undefined && voiceProbe.response.status !== 501);
  if (log?.response.status === 401) redirect("/");
  // 501 (not built yet) or 403: nothing to draw, so the caregiver keeps the plain greeting.
  const care = log?.data;
  if (!care) return fallback();

  const now = new Date();
  const byId = new Map(people.map((p) => [p.id, p]));
  const pending = (handoffs?.data?.items ?? []).filter((h) => h.status === "pending");
  const incoming = pending.find((h) => h.toMemberId === memberId);
  const outgoing = pending.find((h) => h.fromMemberId === memberId);
  const onDuty = care.latest.onDuty ? byId.get(care.latest.onDuty.memberId) : undefined;
  const recipients = people.filter(
    (p) => p.id !== memberId && allows({ role: p.role, permissions: family.caregivers?.find((c) => c.id === p.id)?.permissions }, "care_log"),
  );

  const headline = incoming ? `${byId.get(incoming.fromMemberId)?.displayName ?? "Someone"} is handing ${childCalled(child)} over to you.` : `${givenName(child) ? `${givenName(child)}'s` : "Your baby's"} day`;
  // The side to offer first is the one not used last time; after "both" either is fine.
  const lastBreast = care.items.find((e) => e.kind === "feed" && breastSide(e));
  const nextSide = ({ left: "right", right: "left", both: undefined } as const)[breastSide(lastBreast) ?? "both"];
  const lastBottle = care.items.find((e) => e.kind === "feed" && !breastSide(e))?.feedMethod;
  const openSleep = isAsleep(care.latest.lastSleep) ? care.latest.lastSleep : undefined;
  const names = Object.fromEntries(people.map((p) => [p.id, p.displayName]));

  return (
    <PageFrame className="grid content-start gap-8 @5xl:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)] @7xl:grid-cols-[minmax(0,3fr)_minmax(22rem,1fr)]">
      <div className="flex min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-headline text-balance">{headline}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label font-normal text-muted-foreground">
            {isCaregiver(me.role) ? `${roleLabel[me.role]} view · ` : ""}
            {familyContext(family)}
            {onDuty && <OnDutyChip person={onDuty} since={care.latest.onDuty!.since} isMe={onDuty.id === memberId} />}
          </p>
          {passport?.data && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <AllergyLabel />
              <AllergyChips allergies={passport.data.allergies} />
            </div>
          )}
        </header>

        {incoming && <IncomingHandoff memberId={memberId} handoff={incoming} from={byId.get(incoming.fromMemberId)} now={now} />}

        {/* Status now and logging in one place: each card says when it last happened and logs the next one. */}
        <WhenProvider>
          <section aria-labelledby="log-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id="log-title" className="text-headline">
                Right now
              </h2>
              <div className="w-full sm:w-auto sm:min-w-80">
                <WhenPicker />
              </div>
            </div>
            <div className="grid gap-3 @4xl:grid-cols-3">
              <LogCard kind="feed" entry={care.latest.lastFeed} now={now}>
                <FeedLogger memberId={memberId} childId={child.id} nextSide={nextSide} lastBottle={lastBottle} />
              </LogCard>
              <LogCard kind="sleep" entry={care.latest.lastSleep} now={now}>
                <SleepLogger memberId={memberId} childId={child.id} open={openSleep && { id: openSleep.id, startedAt: openSleep.startedAt }} />
              </LogCard>
              <LogCard kind="diaper" entry={care.latest.lastDiaper} now={now}>
                <QuickAdd memberId={memberId} childId={child.id} actions={diaperActions} />
              </LogCard>
            </div>
          </section>
        </WhenProvider>

        <section aria-labelledby="day-title" className="rounded-3xl border border-line bg-card p-4 md:p-6">
          <CareChart entries={care.items} now={now.toISOString()} memberId={memberId} names={names} />
        </section>

        {caregiver && slots && (
          <>
            <CaregiverTodaySlot shiftOnly today={slots.today} names={names} />
            <WeekCardSlot card={slots.card} />
            <GuidesSlot guides={slots.guides} />
          </>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-6 @5xl:pt-1">
        {outgoing ? (
          <section aria-labelledby="handoff-title" className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-due-soft text-status-due">
                <Hourglass aria-hidden className="size-4.5" />
              </span>
              <h2 id="handoff-title" className="text-title">
                Waiting for {byId.get(outgoing.toMemberId)?.displayName ?? "them"} to accept
              </h2>
            </div>
            {outgoing.voiceNote && <HandoffVoice memberId={memberId} note={outgoing.voiceNote} label="Your voice note" />}
          </section>
        ) : (
          recipients.length > 0 &&
          handoffs?.data && (
            <section aria-labelledby="handoff-title" className="rounded-2xl border border-border bg-card p-4">
              <h2 id="handoff-title" className="mb-3 flex items-center gap-2 text-title">
                <Handshake aria-hidden className="size-4.5 text-muted-foreground" />
                Hand over {childCalled(child)}
              </h2>
              <HandoffForm memberId={memberId} recipients={recipients} childName={childCalled(child)} voice={voice} />
            </section>
          )
        )}
        {passport?.data && <BabyCard passport={passport.data} />}
        <PortraitFlipbook memberId={memberId} childId={child.id} />
      </aside>

      {milestones?.data && (
        <div className="min-w-0 @5xl:col-span-2">
          <MilestoneCard memberId={memberId} childId={child.id} checklist={milestones.data} />
        </div>
      )}
    </PageFrame>
  );
}

function OnDutyChip({ person, since, isMe }: { person: Person; since: string; isMe: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground">
      <span aria-hidden className={cn("flex size-5 items-center justify-center rounded-full text-caption font-semibold text-card", roleAccent[person.role].bg)}>
        {person.displayName.charAt(0).toUpperCase()}
      </span>
      {isMe ? "You have" : `${person.displayName} has`} the baby since <span className="font-mono">{formatClock(since)}</span>
    </span>
  );
}

function LogCard({ kind, entry, now, children }: { kind: CareLogKind; entry?: CareLogEntry; now: Date; children: React.ReactNode }) {
  const Icon = careLogIcon[kind];
  const asleep = isAsleep(entry);
  const main = !entry
    ? "Not logged yet"
    : kind === "sleep"
      ? asleep
        ? `Asleep ${durationWords(now.getTime() - Date.parse(entry.startedAt))}`
        : "Awake"
      : agoWords(entry.startedAt, now);
  const what = !entry
    ? ""
    : kind === "feed"
      ? `${feedMethodLabel[entry.feedMethod ?? "bottle_formula"]}${entry.amountMl ? `, ${entry.amountMl} ml` : ""}`
      : kind === "diaper"
        ? diaperLabel[entry.diaper ?? "wet"]
        : "";
  const sub = !entry
    ? "Log the first one below"
    : kind === "sleep"
      ? `since ${formatClock(asleep ? entry.startedAt : lastActivityAt(entry))}`
      : `${formatClock(entry.startedAt)} · ${what}`;
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-3xl border border-line bg-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", careLogTint[kind].soft)}>
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-label font-medium text-muted-foreground">{careLogLabel[kind]}</h3>
          <p className="text-title font-semibold">{main}</p>
          <p className="text-caption text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

// The receiver's card: what the baby did lately, the sender's note, one big button.
function IncomingHandoff({ memberId, handoff, from, now }: { memberId: string; handoff: Handoff; from?: Person; now: Date }) {
  const s = handoff.careSummary;
  return (
    <section aria-labelledby="incoming-title" className="rounded-2xl border-2 border-primary bg-card p-4">
      <h2 id="incoming-title" className="flex items-center gap-2 text-title">
        <Handshake aria-hidden className="size-4.5 text-primary" />
        Handoff from {from?.displayName ?? "the family"}
      </h2>
      <SummaryChips summary={s} now={now} />
      {handoff.note && <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-body">{handoff.note}</p>}
      {handoff.voiceNote && <HandoffVoice memberId={memberId} note={handoff.voiceNote} label={`Voice note from ${from?.displayName ?? "them"}`} className="mt-3" />}
      <div className="mt-4">
        <AcceptHandoff memberId={memberId} handoffId={handoff.id} fromName={from?.displayName ?? "They"} />
      </div>
    </section>
  );
}

const NO_NOTE = "00000000-0000-4000-8000-000000000000";

// The audio is served by the API (getVoiceNote) to anyone who may see the handoff.
function HandoffVoice({ memberId, note, label, className }: { memberId: string; note: VoiceNote; label: string; className?: string }) {
  return <VoicePlayer src={`/api/members/${memberId}/voice-notes/${note.id}`} durationSeconds={note.durationSeconds} label={label} className={className} />;
}

function SummaryChips({ summary, now }: { summary: CareSummary; now: Date }) {
  const items: { kind: CareLogKind; text: string }[] = [];
  if (summary.lastFeed) {
    const f = summary.lastFeed;
    items.push({ kind: "feed", text: `${agoWords(f.startedAt, now)}${f.feedMethod ? `, ${feedMethodLabel[f.feedMethod].toLowerCase()}` : ""}${f.amountMl ? `, ${f.amountMl} ml` : ""}` });
  }
  if (summary.lastSleep) {
    const s = summary.lastSleep;
    items.push({ kind: "sleep", text: isAsleep(s) ? `asleep since ${formatClock(s.startedAt)}` : `awake since ${formatClock(lastActivityAt(s))}` });
  }
  if (summary.lastDiaper) {
    const d = summary.lastDiaper;
    items.push({ kind: "diaper", text: `${agoWords(d.startedAt, now)}${d.diaper ? `, ${diaperLabel[d.diaper].toLowerCase()}` : ""}` });
  }
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {items.map((i) => {
        const Icon = careLogIcon[i.kind];
        return (
          <li key={i.kind} className={cn("flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-label font-medium", careLogTint[i.kind].soft)}>
            <span className="flex size-6 items-center justify-center rounded-full bg-card/60">
              <Icon aria-hidden className="size-3.5" />
            </span>
            <span className="sr-only">{careLogLabel[i.kind]}: </span>
            {i.text}
          </li>
        );
      })}
    </ul>
  );
}
