import type { Allergy } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { allergyIcon, passportIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { EmptyLine, SectionCard } from "./section-card";

// Two shapes on purpose: a solid tile with a shield for confirmed, a dashed
// circle with a question mark for suspected. The word is repeated for screen readers.
export function AllergiesCard({ allergies }: { allergies: Allergy[] }) {
  return (
    <SectionCard id="allergies-title" icon={passportIcon.allergies} title="Allergies">
      {allergies.length === 0 ? (
        <EmptyLine>No allergies recorded.</EmptyLine>
      ) : (
        <ul className="flex flex-col gap-3">
          {allergies.map((a) => {
            const Icon = allergyIcon[a.certainty];
            const confirmed = a.certainty === "confirmed";
            return (
              <li key={a.id} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center",
                    confirmed ? "rounded-lg bg-status-due text-card" : "rounded-full border-2 border-dashed border-status-due text-status-due",
                  )}
                >
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium">
                    {a.substance} <span className="text-label font-normal text-muted-foreground">{confirmed ? "Confirmed" : "Suspected"}</span>
                  </p>
                  <p className="text-label text-muted-foreground">
                    {a.reaction}
                    {a.notedOn && <span className="font-mono text-caption"> · {formatLongDate(a.notedOn)}</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
