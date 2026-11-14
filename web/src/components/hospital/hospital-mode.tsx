import Link from "next/link";
import { Car, Check, FileText, MapPinned, Phone } from "lucide-react";
import type { BirthPlan, Task } from "@/lib/api/types";
import { HOSPITAL_BAGS, bagProgress } from "@/lib/hospital";
import { bagIcon, bagLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/plan/hospital-bags";
import { TellPartner } from "./tell-partner";

// "Going to the hospital": one screen for the moment labour starts. Big targets,
// no reading needed: who to call, tell your partner, the route, what is in
// the bags and what is missing, the papers to bring. Everything is read from the
// birth plan and the bag tasks; nothing is typed in here.
export function HospitalMode({
  plan,
  bags,
  memberId,
  partner,
}: {
  plan: BirthPlan;
  /** Hospital bag tasks; undefined when they cannot be read, which hides the bag card. */
  bags?: Task[];
  memberId: string;
  /** The other parent, for the "tell" button. */
  partner?: { id: string; name: string };
}) {
  const { hospital, contacts, documents } = plan;
  const missing = bags?.filter((t) => !t.done) ?? [];
  const progress = bags ? bagProgress(bags) : undefined;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2 2xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-3">
        {partner && <TellPartner memberId={memberId} name={partner.name} />}
        {contacts.map((c) => (
          <a
            key={c.label}
            href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
            className="flex min-h-16 items-center gap-4 rounded-2xl border border-border bg-card px-5 py-3 transition-colors duration-150 hover:bg-muted"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <Phone className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-title">{c.name}</span>
              <span className="block text-label font-normal text-muted-foreground">{c.label}</span>
            </span>
            <span className="font-mono text-label">{c.phone}</span>
          </a>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="route-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="route-title" className="sr-only">
            Route
          </h2>
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <MapPinned className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-title">{hospital.name}</p>
              <p className="text-label font-normal text-muted-foreground">{hospital.address}</p>
            </div>
          </div>
          {hospital.travelMinutes != null && (
            <p className="mt-4 flex items-baseline gap-2">
              <Car className="size-4.5 self-center text-muted-foreground" aria-hidden />
              <span className="font-mono text-display">{hospital.travelMinutes}</span>
              <span className="text-label font-normal text-muted-foreground">min by car without traffic</span>
            </p>
          )}
          {hospital.mapsUrl && (
            <a
              href={hospital.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary text-label font-semibold text-secondary-foreground transition-colors duration-150 hover:bg-muted"
            >
              Open the route
            </a>
          )}
        </section>

        {plan.preferencesNote && (
          <p className="rounded-2xl border border-border bg-card p-5 text-body">
            <span className="block text-label font-medium text-muted-foreground">Birth preferences to share</span>
            {plan.preferencesNote}
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:col-span-2 2xl:col-span-1">
        {bags && progress && (
          <section aria-labelledby="bags-title" className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <ProgressRing done={progress.done} total={progress.total} />
              <div className="min-w-0 flex-1">
                <h2 id="bags-title" className="text-title">
                  {missing.length === 0 ? "Bags are packed" : `${missing.length} to pack`}
                </h2>
                <Link href={`/family/${memberId}/plan`} className="inline-flex min-h-11 items-center text-label text-primary hover:underline md:min-h-0">
                  Open the bag lists
                </Link>
              </div>
            </div>
            {missing.length > 0 && (
              <ul className="mt-3 flex flex-col gap-3">
                {HOSPITAL_BAGS.map((bag) => {
                  const left = missing.filter((t) => t.bag === bag);
                  if (left.length === 0) return null;
                  const Icon = bagIcon[bag];
                  return (
                    <li key={bag}>
                      <p className="flex items-center gap-2 text-label font-medium text-muted-foreground">
                        <Icon className="size-4" aria-hidden />
                        {bagLabel[bag]}
                      </p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {left.map((t) => (
                          <li key={t.id} className="rounded-full bg-status-due-soft px-2.5 py-1 text-caption text-status-due">
                            {t.title}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section aria-labelledby="docs-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="docs-title" className="flex items-center gap-2 text-title">
            <FileText className="size-4.5 text-muted-foreground" aria-hidden />
            Bring these
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {documents.map((d) => (
              <li key={d.title} className="flex items-start gap-3 py-2.5">
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", d.ready ? "bg-status-ok text-primary-foreground" : "border-2 border-border")}>
                  {d.ready && <Check className="size-3" strokeWidth={3} aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-label font-semibold">
                    {d.title}
                    <span className="sr-only">{d.ready ? ", ready" : ", not ready"}</span>
                  </span>
                  {d.detail && <span className="block text-caption text-muted-foreground">{d.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
