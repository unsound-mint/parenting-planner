import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, CalendarDays, ChevronRight, FlaskConical, ListChecks, Lock, MessageCircleQuestion, NotebookPen, Rss, Smile, Baby, Stethoscope, UserPlus, type LucideIcon } from "lucide-react";
import type { CalendarFeed, Caregiver, CaregiverPermission, Family, NotificationList, Parent } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { roleIcon, roleLabel } from "@/lib/visuals";
import { syncNote } from "@/lib/schedule";
import { PermissionRow } from "@/components/people/permission-row";

const allPermissions: CaregiverPermission[] = ["care_log", "baby_passport", "schedule", "family_plan", "pregnancy_updates"];

export function Card({ title, icon: Icon, children, id }: { title: string; icon: LucideIcon; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={`${id ?? title}-title`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 id={`${id ?? title}-title`} className="flex items-center gap-2.5 text-title">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Icon className="size-4.5" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const linkClass =
  "inline-flex min-h-11 items-center gap-1 self-start rounded-full px-3 text-label font-medium text-primary transition-colors duration-150 outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9";

/** The other parent: sees what is shared with the family, never what stays private. */
export function PartnerCard({ partner }: { partner: Parent }) {
  const Icon = roleIcon[partner.role];
  const shared: [LucideIcon, string][] = [
    [CalendarDays, "Events set to Family"],
    [ListChecks, "The shared plan"],
    [Baby, "Baby care"],
  ];
  return (
    <Card title={partner.displayName} icon={Icon} id={`person-${partner.id}`}>
      <p className="-mt-1 text-label font-normal text-muted-foreground">{roleLabel[partner.role]}</p>
      <ul className="flex flex-col">
        {shared.map(([SIcon, text]) => (
          <li key={text} className="flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SIcon className="size-4.5" />
            </span>
            <span className="text-label font-medium">{text}</span>
          </li>
        ))}
        <li className="flex min-h-12 items-center gap-3 border-t border-border py-2">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="size-4.5" />
          </span>
          <span className="text-label font-medium">Private items stay private</span>
        </li>
      </ul>
      <p className="text-caption text-muted-foreground">You choose per item when you add it: Only you, or Family.</p>
    </Card>
  );
}

/** One caregiver with every permission the API can grant, on or off. */
export function CaregiverCard({ memberId, caregiver }: { memberId: string; caregiver: Caregiver }) {
  const Icon = roleIcon[caregiver.role];
  return (
    <Card title={caregiver.displayName} icon={Icon} id={`person-${caregiver.id}`}>
      <p className="-mt-1 text-label font-normal text-muted-foreground">{roleLabel[caregiver.role]}</p>
      <div className="flex flex-col">
        {allPermissions.map((p) => (
          <PermissionRow key={p} permission={p} on={caregiver.permissions.includes(p)} idPrefix={`${caregiver.id}`} />
        ))}
      </div>
      <Link href={`/family/${memberId}/people`} className={linkClass}>
        Change in People
        <ChevronRight aria-hidden className="size-4" />
      </Link>
    </Card>
  );
}

export function WaitingInvitations({ memberId, count }: { memberId: string; count: number }) {
  return (
    <Link
      href={`/family/${memberId}/people`}
      className="flex min-h-14 items-center gap-3 self-start rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-label transition-colors duration-150 hover:bg-muted"
    >
      <UserPlus aria-hidden className="size-5 text-muted-foreground" />
      <span className="flex-1">
        {count === 0 ? "Invite a grandparent or nanny" : `${count} ${count === 1 ? "invitation is" : "invitations are"} waiting to be opened`}
      </span>
      <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
    </Link>
  );
}

const never: [LucideIcon, string][] = [
  [NotebookPen, "Diary"],
  [Smile, "Mood check-ins"],
  [FlaskConical, "Lab results"],
  [Stethoscope, "Session notes"],
  [MessageCircleQuestion, "Appointment questions"],
];

/** Fixed: the API cannot grant these records to a caregiver at all. Partner access is per entry. */
export function NeverShared({ forCaregiver }: { forCaregiver: boolean }) {
  return (
    <Card title="Never shared" icon={Lock}>
      <ul className="grid grid-cols-2 gap-2">
        {never.map(([Icon, text]) => (
          <li key={text} className="flex min-h-12 items-center gap-2.5 rounded-xl bg-muted px-3 py-2 text-label">
            <Icon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
            {text}
          </li>
        ))}
      </ul>
      <p className="text-caption text-muted-foreground">
        {forCaregiver ? "These belong to the parents and never appear here." : "No caregiver can see these. Your partner sees an entry only if you share that entry."}
      </p>
    </Card>
  );
}

export function FeedCard({ memberId, feed }: { memberId: string; feed: CalendarFeed }) {
  return (
    <Card title="Calendar link" icon={Rss}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-caption font-semibold",
            feed.active ? "bg-status-ok-soft text-status-ok" : "bg-muted text-muted-foreground",
          )}
        >
          {feed.active ? "Active" : "Off"}
        </span>
        {feed.active && feed.scope && <span className="text-label">{feed.scope === "family" ? "Whole family" : "Only yours"}</span>}
      </div>
      {feed.active && (
        <p className="font-mono text-caption text-muted-foreground">
          {feed.lastFetchedAt ? `Last read ${formatShortDate(feed.lastFetchedAt)}` : "Not read by a calendar app yet"}
        </p>
      )}
      <p className="text-caption text-muted-foreground">Psychologist sessions are never included. {syncNote}</p>
      <Link href={`/family/${memberId}/calendar#subscribe`} className={linkClass}>
        {feed.active ? "Manage the link" : "Create a link"}
        <ChevronRight aria-hidden className="size-4" />
      </Link>
    </Card>
  );
}

export function NotificationsCard({ list }: { list: NotificationList }) {
  return (
    <Card title="Notifications" icon={Bell}>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-headline tabular-nums">{list.unreadCount}</span>
        <span className="text-label text-muted-foreground">unread in the bell</span>
      </p>
      <p className="text-caption text-muted-foreground">Only things addressed to you show up there, never anyone else&apos;s.</p>
    </Card>
  );
}

export function StageCard({ family, children }: { family: Pick<Family, "dueDate" | "stage">; children: ReactNode }) {
  return (
    <Card title="Stage and due date" icon={Baby}>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        {family.dueDate && <span className="font-mono text-label">Due {formatShortDate(family.dueDate)}</span>}
      </div>
      <p className="text-caption text-muted-foreground">Your plan and guides follow the stage.</p>
    </Card>
  );
}
