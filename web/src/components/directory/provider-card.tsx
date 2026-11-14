import Link from "next/link";
import { ArrowRight, CalendarClock, DollarSign, Languages, Sparkles } from "lucide-react";
import type { Provider, ProviderSlot } from "@/lib/api/types";
import { providerTypeIcon, providerTypeLabel, visitModeIcon, visitModeLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { openingLabel } from "./openings";

export function initials(name: string): string {
  return name
    .replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Chip({ icon: Icon, children, label, strong }: { icon: React.ElementType; children: React.ReactNode; label: string; strong?: boolean }) {
  return (
    <li
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-label whitespace-nowrap",
        strong ? "bg-status-up-soft font-semibold text-status-up" : "bg-muted text-foreground",
      )}
    >
      <span className="sr-only">{label}: </span>
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </li>
  );
}

/** "Next opening Tue 10:00 AM", from the soonest stored open time. */
export function NextOpening({ first, now }: { first?: ProviderSlot; now: Date }) {
  return (
    <Chip icon={CalendarClock} label="Next opening" strong={!!first}>
      {first ? (
        <>
          <span className="font-normal opacity-80">Next</span>
          <span className="font-mono">{openingLabel(first.startsAt, now)}</span>
        </>
      ) : (
        <span className="font-normal">No open times in the next two weeks</span>
      )}
    </Chip>
  );
}

// The opening, price, how they see you and languages as chips: the things a
// parent compares first. The whole card opens the profile with its times.
export function ProviderCard({
  provider,
  href,
  first,
  reason,
  featured,
  now,
}: {
  provider: Provider;
  /** The profile route with its open times. */
  href: string;
  first?: ProviderSlot;
  /** Why it is suggested ("Because ..."), on a recommendation. */
  reason?: string;
  featured?: boolean;
  /** The family's "now" (lib/clock.ts). */
  now: Date;
}) {
  const TypeIcon = providerTypeIcon[provider.type];
  return (
    <li className="min-w-0">
      <Link
        href={href}
        className={cn(
          "press lift group flex h-full flex-col gap-4 rounded-3xl border border-line bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          featured ? "p-5.5 md:p-6" : "p-4.5",
        )}
      >
        {reason && (
          <p className="flex items-start gap-1.5 text-label text-me">
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
            {reason}
          </p>
        )}
        <div className="flex items-center gap-3">
          <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-them-soft font-semibold text-them", featured ? "size-12 text-title" : "size-11 text-label")}>
            {initials(provider.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-title">{provider.name}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-label font-normal text-muted-foreground">
              <TypeIcon className="size-4 shrink-0" aria-hidden />
              {providerTypeLabel[provider.type].one}
              <span aria-hidden>·</span>
              <span>
                {provider.city}, <span className="font-mono">{provider.state}</span>
              </span>
            </p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
        </div>
        {featured && <p className="text-body text-ink-2">{provider.summary}</p>}
        <ul className="mt-auto flex flex-wrap gap-2">
          <NextOpening first={first} now={now} />
          <Chip icon={DollarSign} label="Price per visit">
            <span className="font-mono">{provider.priceUsd}</span>
            <span className="text-muted-foreground">a visit</span>
          </Chip>
          {provider.visitModes.map((m) => {
            const Icon = visitModeIcon[m];
            return (
              <Chip key={m} icon={Icon} label="Visits">
                {visitModeLabel[m]}
              </Chip>
            );
          })}
          {featured && (
            <Chip icon={Languages} label="Languages">
              {provider.languages.join(", ")}
            </Chip>
          )}
        </ul>
      </Link>
    </li>
  );
}

