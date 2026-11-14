import { Check } from "lucide-react";
import type { BookingRequest, Provider } from "@/lib/api/types";
import { providerTypeIcon, providerTypeLabel, visibilityIcon } from "@/lib/visuals";

// The acting parent's own booking requests. Private: the partner never sees them.
export function RequestsCard({ requests, providers }: { requests: BookingRequest[]; providers: Provider[] }) {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const PrivateIcon = visibilityIcon.private;
  return (
    <section aria-labelledby="requests-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <h2 id="requests-title" className="flex-1 text-title">
          Your requests
        </h2>
        <span className="font-mono text-title tabular-nums">{requests.length}</span>
      </div>
      {requests.length === 0 ? (
        <p className="mt-3 text-label text-muted-foreground">Nothing requested yet. Pick someone and ask for a visit.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {requests.map((r) => {
            const p = byId.get(r.providerId);
            const Icon = p ? providerTypeIcon[p.type] : Check;
            return (
              <li key={r.id} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-up-soft text-status-up">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-label font-medium">{p?.name ?? "Provider"}</span>
                  <span className="block truncate text-caption text-muted-foreground">{p ? providerTypeLabel[p.type].one : ""}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-caption font-semibold text-secondary-foreground">
                  <Check className="size-3" aria-hidden />
                  Requested
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-caption text-muted-foreground">
        <PrivateIcon className="size-4 shrink-0" aria-hidden />
        Only you can see your requests.
      </p>
    </section>
  );
}
