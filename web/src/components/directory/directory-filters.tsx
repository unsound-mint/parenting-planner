import Link from "next/link";
import { ListFilter } from "lucide-react";
import type { ProviderType, VisitMode } from "@/lib/api/types";
import { providerTypeIcon, providerTypeLabel, providerTypes, visitModeLabel, visitModes } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { FilterSelect } from "./filter-select";

// Filters live in the URL (?type=&state=&mode=) so the plan can link straight
// to a filtered list. Type is the main choice, so it gets a row of chips;
// how you meet and the state are two compact dropdowns beside it.
function href(base: string, type?: ProviderType, state?: string, mode?: VisitMode) {
  const q = new URLSearchParams();
  if (type) q.set("type", type);
  if (state) q.set("state", state);
  if (mode) q.set("mode", mode);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

const chip =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-label whitespace-nowrap transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";
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
    <div className="flex flex-col gap-3 @4xl:flex-row @4xl:items-start @4xl:gap-6">
      {/* One scrolling row on phones; wraps once there is room. */}
      <nav aria-label="Provider type" className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 @4xl:flex-wrap @4xl:overflow-visible @4xl:pb-0">
        <Link href={href(base, undefined, state, mode)} scroll={false} aria-current={!type ? "true" : undefined} className={cn(chip, !type ? on : off)}>
          <ListFilter className="size-4" aria-hidden />
          All
        </Link>
        {providerTypes
          .filter((t) => counts[t] || t === type)
          .map((t) => {
            const Icon = providerTypeIcon[t];
            return (
              <Link key={t} href={href(base, t, state, mode)} scroll={false} aria-current={type === t ? "true" : undefined} className={cn(chip, type === t ? on : off)}>
                <Icon className="size-4" aria-hidden />
                {providerTypeLabel[t].many}
                <span className="font-mono text-caption opacity-70">{counts[t] ?? 0}</span>
              </Link>
            );
          })}
      </nav>

      <div className="flex shrink-0 gap-2">
        <FilterSelect
          label="How you meet"
          className="flex-1 @4xl:w-40 @4xl:flex-none"
          value={href(base, type, state, mode)}
          options={[{ href: href(base, type, state), label: "Any way to meet" }, ...visitModes.map((m) => ({ href: href(base, type, state, m), label: visitModeLabel[m] }))]}
        />
        {states.length > 1 && (
          <FilterSelect
            label="State"
            className="flex-1 @4xl:w-32 @4xl:flex-none"
            value={href(base, type, state, mode)}
            options={[{ href: href(base, type, undefined, mode), label: "Any state" }, ...states.map((s) => ({ href: href(base, type, s, mode), label: s }))]}
          />
        )}
      </div>
    </div>
  );
}
