import { Activity, CalendarClock, DollarSign, Languages, MapPin } from "lucide-react";
import type { Provider } from "@/lib/api/types";
import { daysUntil, formatShortDate } from "@/lib/format";
import { providerTypeIcon, providerTypeLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { BookButton } from "./book-button";

export function whenLabel(isoDate: string, now: Date): string {
  const d = daysUntil(isoDate, now);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

function initials(name: string): string {
  return name
    .replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Chip({ icon: Icon, children, label, strong }: { icon: React.ElementType; children: React.ReactNode; label: string; strong?: boolean }) {
  return (
    <li
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-label",
        strong ? "bg-status-up-soft font-semibold text-status-up" : "bg-muted text-foreground",
      )}
    >
      <span className="sr-only">{label}: </span>
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </li>
  );
}

// Price, soonest slot and languages as chips: the three things a parent
// compares first. The request state lives on the card, not in a second list.
export function ProviderCard({
  provider,
  memberId,
  requested,
  featured,
  reason,
  now,
}: {
  provider: Provider;
  memberId: string;
  requested: boolean;
  /** Large card for a recommendation; the compact row otherwise. */
  featured?: boolean;
  /** Set only when a check-in pattern is the reason. */
  reason?: string;
  /** The family's "now" (lib/clock.ts). */
  now: Date;
}) {
  const TypeIcon = providerTypeIcon[provider.type];
  const feature = !!featured;
  const slot = (
    <>
      <span className="font-mono">{formatShortDate(provider.nextAvailable)}</span>
      <span className="font-normal opacity-80">{whenLabel(provider.nextAvailable, now)}</span>
    </>
  );
  const chips = (
    <ul className="flex flex-wrap gap-2">
      <Chip icon={CalendarClock} label="Soonest" strong>
        {slot}
      </Chip>
      <Chip icon={DollarSign} label="Price per session">
        <span className="font-mono">{provider.priceUsd}</span>
        <span className="text-muted-foreground">a session</span>
      </Chip>
      <Chip icon={Languages} label="Languages">
        {provider.languages.join(", ")}
      </Chip>
      {feature && (
        <Chip icon={MapPin} label="Location">
          {provider.city}, <span className="font-mono">{provider.state}</span>
        </Chip>
      )}
    </ul>
  );

  const head = (
    <div className="flex items-center gap-3">
      <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground", feature ? "size-12 text-title" : "size-10 text-label")}>
        {initials(provider.name)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-title">{provider.name}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-label text-muted-foreground">
          <TypeIcon className="size-4 shrink-0" aria-hidden />
          {providerTypeLabel[provider.type].one}
          {!feature && (
            <span>
              · {provider.city}, <span className="font-mono">{provider.state}</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );

  if (!feature) {
    return (
      <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center md:gap-4">
        <div className="md:w-72 md:shrink-0">{head}</div>
        <div className="md:flex-1">{chips}</div>
        <div className="md:shrink-0">
          <BookButton memberId={memberId} providerId={provider.id} providerName={provider.name} requested={requested} compact />
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      {reason && (
        <p className="flex items-center gap-1.5 text-label font-semibold text-primary">
          <Activity className="size-4" aria-hidden />
          {reason}
        </p>
      )}
      {head}
      <p className="text-body">{provider.summary}</p>
      {chips}
      <div className="mt-auto pt-1">
        <BookButton memberId={memberId} providerId={provider.id} providerName={provider.name} requested={requested} />
      </div>
    </li>
  );
}
