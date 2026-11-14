import { CalendarClock, DollarSign, Languages, MapPin } from "lucide-react";
import type { Provider } from "@/lib/api/types";
import { daysUntil, formatShortDate } from "@/lib/format";
import { providerTypeIcon, providerTypeLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { BookButton } from "./book-button";

// The availability bar spans the next four weeks: fuller means sooner.
const WINDOW_DAYS = 28;

export function whenLabel(isoDate: string): string {
  const d = daysUntil(isoDate);
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

export function ProviderCard({
  provider,
  memberId,
  requested,
  soonest,
}: {
  provider: Provider;
  memberId: string;
  requested: boolean;
  soonest?: boolean;
}) {
  const TypeIcon = providerTypeIcon[provider.type];
  const days = Math.max(0, daysUntil(provider.nextAvailable));
  const fill = Math.max(0.06, 1 - Math.min(days, WINDOW_DAYS) / WINDOW_DAYS);

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-5",
        soonest ? "border-primary ring-1 ring-primary/30" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-title font-semibold text-secondary-foreground"
        >
          {initials(provider.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-title">{provider.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-label text-muted-foreground">
            <TypeIcon className="size-4 shrink-0" aria-hidden />
            {providerTypeLabel[provider.type].one}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
          Demo provider
        </span>
      </div>

      <p className="text-body">{provider.summary}</p>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-1.5 text-label">
            <CalendarClock className="size-4 text-status-up" aria-hidden />
            <span className="font-mono">{formatShortDate(provider.nextAvailable)}</span>
            <span className="text-muted-foreground">{whenLabel(provider.nextAvailable)}</span>
          </span>
          {soonest && <span className="text-caption font-semibold text-primary">Soonest</span>}
        </div>
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full origin-left rounded-full bg-status-up" style={{ transform: `scaleX(${fill})`, width: "100%" }} />
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-label text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Location</dt>
          <MapPin className="size-4" aria-hidden />
          <dd>
            {provider.city}, <span className="font-mono">{provider.state}</span>
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Languages</dt>
          <Languages className="size-4" aria-hidden />
          <dd>{provider.languages.join(", ")}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Price per session</dt>
          <DollarSign className="size-4" aria-hidden />
          <dd>
            <span className="font-mono">{provider.priceUsd}</span> a session
          </dd>
        </div>
      </dl>

      <div className="mt-auto">
        <BookButton memberId={memberId} providerId={provider.id} providerName={provider.name} requested={requested} />
      </div>
    </li>
  );
}
