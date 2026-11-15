import Link from "next/link";
import { CalendarClock, Sparkles } from "lucide-react";
import type { Provider, ProviderSlot } from "@/lib/api/types";
import { providerTypeIcon, providerTypeLabel, visitModeLabel } from "@/lib/visuals";
import { buttonVariants } from "@/components/ui/button";
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

/** "$90 a visit · In person, Home visits · English, Spanish": the facts a parent compares, as one quiet line. */
export function ProviderMeta({ provider, minutes, className }: { provider: Provider; minutes?: boolean; className?: string }) {
  return (
    <p className={cn("text-label font-normal text-muted-foreground", className)}>
      <span className="sr-only">Price: </span>
      <span className="font-mono text-ink-2">${provider.priceUsd}</span> a visit
      {minutes && (
        <>
          {" "}
          of <span className="font-mono">{provider.sessionMinutes}</span> min
        </>
      )}
      <span aria-hidden> · </span>
      <span className="sr-only">Visits: </span>
      {provider.visitModes.map((m) => visitModeLabel[m]).join(", ")}
      <span aria-hidden> · </span>
      <span className="sr-only">Languages: </span>
      {provider.languages.join(", ")}
    </p>
  );
}

/** The soonest stored open time as the card's one action: "Book Tue 10:00 AM". */
function BookAction({ first, now, compact }: { first?: ProviderSlot; now: Date; compact?: boolean }) {
  if (!first) return <span className="text-label text-muted-foreground">No open times in the next two weeks</span>;
  return (
    <span
      className={cn(
        // Filled only on the few picks, so they outrank the long list below.
        buttonVariants({ variant: compact ? "outline" : "default" }),
        "self-start rounded-full text-label",
        compact ? "h-9 px-3.5 group-hover:bg-muted" : "h-10 px-4 group-hover:bg-primary/85",
      )}
    >
      <CalendarClock aria-hidden />
      Book <span className="font-mono">{openingLabel(first.startsAt, now)}</span>
    </span>
  );
}

// Reading order: who (name, role and city), why (on a pick), the next open
// time as the one action, then price, modes and languages as one quiet line.
// The whole card is one link to the profile, where the times are booked.
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
          "press lift group flex h-full flex-col rounded-3xl border border-line bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          featured ? "gap-4 p-5.5 md:p-6" : "gap-3 p-4.5",
        )}
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-them-soft font-semibold text-them", featured ? "size-12 text-title" : "size-10 text-label")}>
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
        </div>
        {reason && (
          <p className="flex items-start gap-1.5 text-body text-ink-2">
            <Sparkles className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {reason}
          </p>
        )}
        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          <BookAction first={first} now={now} compact={!featured} />
          <ProviderMeta provider={provider} />
        </div>
      </Link>
    </li>
  );
}
