import Link from "next/link";
import { Car, Check, FileText, MapPinned, Phone } from "lucide-react";
import type { BirthPlan, Task } from "@/lib/api/types";
import { HOSPITAL_BAGS, bagProgress } from "@/lib/hospital";
import { bagIcon, bagLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/plan/hospital-bags";
import { SoftCard } from "@/components/joy/soft-card";
import { Stack } from "@/components/shell/page";
import { TellPartner } from "./tell-partner";

// "Going to the hospital": the cards for the moment labor starts, as cells of
// the page grid. Big targets, no reading needed: tell your partner, who to
// call, the route, what is still missing from the bags and the papers to
// bring. Everything is read from the birth plan and the bag tasks. The birth
// preferences live in the "Before the day" list, so they are not repeated here.
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
    <>
      <Stack>
        <SoftCard as="section" aria-labelledby="calls-title" className="flex flex-col gap-3">
          <h3 id="calls-title" className="text-title">
            When it starts
          </h3>
          {partner && <TellPartner memberId={memberId} name={partner.name} />}
          <ul className="flex flex-col gap-2">
            {contacts.map((c) => (
              <li key={c.label}>
                <a
                  href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                  className="press flex min-h-16 items-center gap-3 rounded-2xl bg-muted/70 px-4 py-2.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-them-soft text-them">
                    <Phone className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-semibold">{c.name}</span>
                    <span className="block text-caption text-muted-foreground">{c.label}</span>
                  </span>
                  <span className="font-mono text-label">{c.phone}</span>
                </a>
              </li>
            ))}
          </ul>
        </SoftCard>

        {bags && progress && (
          <SoftCard as="section" aria-labelledby="bags-title" className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <ProgressRing done={progress.done} total={progress.total} />
              <div className="min-w-0 flex-1">
                <h3 id="bags-title" className="text-title">
                  {missing.length === 0 ? "Bags are packed" : `${missing.length} left to pack`}
                </h3>
                <Link href={`/family/${memberId}/plan`} className="inline-flex min-h-11 items-center text-label text-primary hover:underline md:min-h-0">
                  Open the bag lists
                </Link>
              </div>
            </div>
            {missing.length > 0 && (
              <ul className="flex flex-col gap-3">
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
                          <li key={t.id} className="rounded-full bg-sun px-3 py-1 text-caption text-ink-2">
                            {t.title}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </SoftCard>
        )}
      </Stack>

      <SoftCard as="section" aria-labelledby="route-title" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sun text-ink-2">
            <MapPinned className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="route-title" className="text-title">
              {hospital.name}
            </h3>
            <p className="text-label font-normal text-muted-foreground">{hospital.address}</p>
          </div>
        </div>
        {hospital.travelMinutes != null && (
          <p className="flex items-baseline gap-2">
            <Car className="size-4.5 self-center text-muted-foreground" aria-hidden />
            <span className="font-mono text-display leading-none">{hospital.travelMinutes}</span>
            <span className="text-label font-normal text-muted-foreground">min by car without traffic</span>
          </p>
        )}
        {hospital.mapsUrl && (
          <a
            href={hospital.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="press flex min-h-12 items-center justify-center gap-2 rounded-full bg-me text-label font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Open the route
          </a>
        )}
        <div className="border-t border-line pt-4">
          <h4 className="flex items-center gap-2 text-label font-semibold">
            <FileText className="size-4 text-muted-foreground" aria-hidden />
            Bring these
          </h4>
          <ul className="mt-2 flex flex-col gap-2.5">
            {documents.map((d) => (
              <li key={d.title} className="flex items-start gap-3">
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", d.ready ? "bg-leaf text-primary-foreground" : "border-2 border-line-2")}>
                  {d.ready && <Check className="size-3" strokeWidth={3} aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-label">
                    {d.title}
                    <span className="sr-only">{d.ready ? ", ready" : ", not ready"}</span>
                  </span>
                  {d.detail && <span className="block text-caption text-muted-foreground">{d.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </SoftCard>

    </>
  );
}
