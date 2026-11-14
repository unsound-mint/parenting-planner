import Link from "next/link";
import { ArrowRight, ClipboardCheck, Phone, Search } from "lucide-react";
import type { BookingRequest, CareTeamMember, MoodScreeningResult, Provider, ScreeningQuestionnaire } from "@/lib/api/types";
import { formatDayNumber, formatMonth } from "@/lib/format";
import { careRoleIcon, careRoleLabel, providerTypeIcon, providerTypeLabel } from "@/lib/visuals";
import { bandWords } from "@/components/wellbeing/screening-bands";
import { BookButton } from "@/components/directory/book-button";
import { whenLabel } from "@/components/directory/provider-card";
import { cn } from "@/lib/utils";

// The calmer rows under the journal: the parent's care team, their mood
// questionnaire, and Find help near you (the directory's door). Small cards,
// one line per thing, each with the one action it needs.

function CalmCard({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-3xl border border-line bg-card p-5.5 md:p-6">
      <div className="flex items-baseline gap-3">
        <h2 className="flex-1 text-title font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="press inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-label text-me outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
            {linkLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-line">{children}</ul>
    </section>
  );
}

function Row({ icon: Icon, tint = "bg-muted text-ink-2", children, side }: { icon: React.ElementType; tint?: string; children: React.ReactNode; side?: React.ReactNode }) {
  return (
    <li className="flex min-h-15 items-center gap-3 py-2.5">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tint)}>
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {side}
    </li>
  );
}

/** The acting parent's own clinicians, from the passport. */
export function CareTeamCard({ memberId, team }: { memberId: string; team: CareTeamMember[] }) {
  return (
    <CalmCard title="Your care team" href={`/family/${memberId}/passport`} linkLabel="Passport">
      {team.length === 0 ? (
        <li className="py-2.5 text-label font-normal text-muted-foreground">Add your doctor or midwife in your passport, so their number is one tap away here.</li>
      ) : (
        team.map((m) => (
          <Row
            key={m.id}
            icon={careRoleIcon[m.role]}
            side={
              m.phone && (
                <a
                  href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}
                  aria-label={`Call ${m.name}`}
                  className="press flex size-11 items-center justify-center rounded-full border border-line-2 text-ink-2 outline-none hover:bg-paper focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Phone className="size-4" aria-hidden />
                </a>
              )
            }
          >
            <p className="truncate text-body font-medium">{m.name}</p>
            <p className="truncate text-caption text-muted-foreground">
              {[careRoleLabel[m.role], m.clinic].filter(Boolean).join(" · ")}
            </p>
          </Row>
        ))
      )}
    </CalmCard>
  );
}

const bandTint = { green: "bg-leaf-soft text-leaf", amber: "bg-sun text-ink-2", red: "bg-me-soft text-me" } as const;

/** The latest own questionnaire result, or an invitation to take one. Never a diagnosis. */
export function ScreeningCard({ memberId, latest, questionnaires }: { memberId: string; latest?: MoodScreeningResult; questionnaires: ScreeningQuestionnaire[] }) {
  const suggested = questionnaires.find((q) => q.suggested);
  const title = (i: string) => questionnaires.find((q) => q.instrument === i)?.title ?? i.toUpperCase();
  return (
    <CalmCard title="Mood questionnaire" href={`/family/${memberId}/care/screening`} linkLabel={latest ? "Results" : "Open"}>
      {suggested && (
        <Row icon={ClipboardCheck} tint="bg-me-soft text-me" side={<Arrow href={`/family/${memberId}/care/screening`} label={`Take ${suggested.title}`} />}>
          <p className="text-body font-medium">{suggested.title}</p>
          <p className="text-caption text-me">Your plan asks for it now · about 2 minutes</p>
        </Row>
      )}
      {latest ? (
        <Row icon={ClipboardCheck} tint={bandTint[latest.band]}>
          <p className="text-body font-medium">
            {title(latest.instrument)}{" "}
            <span className="font-mono text-label font-normal text-muted-foreground">
              {formatMonth(latest.takenAt)} {formatDayNumber(latest.takenAt)}
            </span>
          </p>
          <p className="text-caption text-muted-foreground">
            {bandWords[latest.band].label} · <span className="font-mono">{latest.score}</span> of <span className="font-mono">{latest.maxScore}</span>
          </p>
        </Row>
      ) : (
        !suggested && (
          <Row icon={ClipboardCheck} side={<Arrow href={`/family/${memberId}/care/screening`} label="Take a questionnaire" />}>
            <p className="text-body font-medium">Check in with yourself</p>
            <p className="text-caption text-muted-foreground">A few short questions, only you see the answers</p>
          </Row>
        )
      )}
    </CalmCard>
  );
}

function Arrow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="press flex size-11 items-center justify-center rounded-full bg-me text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

/** Find help near you: the directory's best fits, with a request each. Requests are the acting parent's own. */
export function FindHelpCard({ memberId, picks, requests, now }: { memberId: string; picks: Provider[]; requests: BookingRequest[]; now: Date }) {
  const asked = new Set(requests.map((r) => r.providerId));
  return (
    <CalmCard title="Find help near you" href={`/family/${memberId}/directory`} linkLabel="Everyone">
      {picks.length === 0 ? (
        <Row icon={Search} side={<Arrow href={`/family/${memberId}/directory`} label="Browse providers" />}>
          <p className="text-body font-medium">Doulas, therapists, lactation help</p>
          <p className="text-caption text-muted-foreground">Browse by type and state</p>
        </Row>
      ) : (
        picks.map((p) => (
          <Row key={p.id} icon={providerTypeIcon[p.type]} tint="bg-them-soft text-them" side={<div className="@container w-40 shrink-0"><BookButton memberId={memberId} providerId={p.id} providerName={p.name} requested={asked.has(p.id)} compact /></div>}>
            <p className="truncate text-body font-medium">{p.name}</p>
            <p className="truncate text-caption text-muted-foreground">
              {providerTypeLabel[p.type].one} · free {whenLabel(p.nextAvailable, now)}
            </p>
          </Row>
        ))
      )}
    </CalmCard>
  );
}
