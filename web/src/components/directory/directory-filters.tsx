import Link from "next/link";
import { ListFilter, MapPin } from "lucide-react";
import type { ProviderType, VisitMode } from "@/lib/api/types";
import { providerTypeIcon, providerTypeLabel, providerTypes, visitModeIcon, visitModeLabel, visitModes } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// Filters live in the URL (?type=&state=&mode=) so the plan can link straight
// to a filtered list. Plain links keep this a server component.
function href(base: string, type?: ProviderType, state?: string, mode?: VisitMode) {
  const q = new URLSearchParams();
  if (type) q.set("type", type);
  if (state) q.set("state", state);
  if (mode) q.set("mode", mode);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

const chip =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-label whitespace-nowrap transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";
const on = "border-primary bg-secondary font-semibold text-secondary-foreground";
const off = "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground";

export function DirectoryFilters({
  base,
  type,
  state,
  mode,
  states,
  counts,
}: {
  base: string;
  type?: ProviderType;
  state?: string;
  mode?: VisitMode;
  /** States that have at least one provider, from the unfiltered list. */
  states: string[];
  counts: Partial<Record<ProviderType, number>>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Provider type" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Link href={href(base, undefined, state, mode)} scroll={false} aria-current={!type ? "true" : undefined} className={cn(chip, !type ? on : off)}>
          <ListFilter className="size-4" aria-hidden />
          All
        </Link>
        {providerTypes
          .filter((t) => counts[t] || t === type)
          .map((t) => {
            const Icon = providerTypeIcon[t];
            return (
              <Link
                key={t}
                href={href(base, t, state, mode)}
                scroll={false}
                aria-current={type === t ? "true" : undefined}
                className={cn(chip, type === t ? on : off)}
              >
                <Icon className="size-4" aria-hidden />
                {providerTypeLabel[t].many}
                <span className="font-mono text-caption opacity-70">{counts[t] ?? 0}</span>
              </Link>
            );
          })}
      </nav>

      <nav aria-label="How you meet" className="flex flex-wrap items-center gap-2">
        <Link href={href(base, type, state)} scroll={false} aria-current={!mode ? "true" : undefined} className={cn(chip, "h-8", !mode ? on : off)}>
          Any way
        </Link>
        {visitModes.map((m) => {
          const Icon = visitModeIcon[m];
          return (
            <Link key={m} href={href(base, type, state, m)} scroll={false} aria-current={mode === m ? "true" : undefined} className={cn(chip, "h-8", mode === m ? on : off)}>
              <Icon className="size-4" aria-hidden />
              {visitModeLabel[m]}
            </Link>
          );
        })}
      </nav>

      {states.length > 1 && (
        <nav aria-label="State" className="flex flex-wrap items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" aria-hidden />
          <Link href={href(base, type, undefined, mode)} scroll={false} aria-current={!state ? "true" : undefined} className={cn(chip, "h-8", !state ? on : off)}>
            Any state
          </Link>
          {states.map((s) => (
            <Link
              key={s}
              href={href(base, type, s, mode)}
              scroll={false}
              aria-current={state === s ? "true" : undefined}
              className={cn(chip, "h-8 font-mono", state === s ? on : off)}
            >
              {s}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
