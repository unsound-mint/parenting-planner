import { Phone, ShieldCheck, ShieldAlert, Stethoscope, Syringe } from "lucide-react";
import type { ChildPassport } from "@/lib/api/types";
import { personName } from "@/lib/format";
import { allergyIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// Allergies as icon chips: they sit at the top of the screen, where a
// caregiver looks before feeding. Confirmed is a solid shield, suspected a question mark.
export function AllergyChips({ allergies }: { allergies: ChildPassport["allergies"] }) {
  if (allergies.length === 0) {
    return (
      <p className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-status-ok-soft px-3 text-label font-medium text-status-ok">
        <ShieldCheck aria-hidden className="size-4" />
        No known allergies
      </p>
    );
  }
  return (
    <ul aria-label="Allergies" className="flex flex-wrap gap-2">
      {allergies.map((a) => {
        const Icon = allergyIcon[a.certainty];
        return (
          <li
            key={a.id}
            title={a.reaction}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-label font-semibold",
              a.certainty === "confirmed" ? "bg-status-late-soft text-status-late" : "bg-status-due-soft text-status-due",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {a.substance}
            <span className="sr-only">, {a.certainty}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function AllergyLabel() {
  return (
    <span className="flex items-center gap-1.5 text-label font-medium text-muted-foreground">
      <ShieldAlert aria-hidden className="size-4" />
      Allergies
    </span>
  );
}

// The baby card: who to call. A caregiver gets the limited view, so nothing
// about vaccines or medical history is drawn unless the API sent it (parents).
export function BabyCard({ passport }: { passport: ChildPassport }) {
  const { pediatrician, emergencyContacts, vaccines } = passport;
  const nextVaccine = vaccines?.find((v) => v.status !== "done");
  const given = vaccines?.filter((v) => v.status === "done").length ?? 0;
  if (!pediatrician && emergencyContacts.length === 0 && !vaccines) return null;

  return (
    <section aria-labelledby="baby-card" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="baby-card" className="text-title">
        Who to call
      </h2>
      <ul className="mt-3 flex flex-col gap-1">
        {pediatrician && (
          <Contact icon={<Stethoscope aria-hidden className="size-4" />} name={pediatrician.name} sub={pediatrician.clinic} phone={pediatrician.phone} />
        )}
        {emergencyContacts.map((c) => (
          <Contact key={c.phone} icon={<Phone aria-hidden className="size-4" />} name={personName(c.name, c.relation)} sub={personName(c.name, "") ? c.relation : undefined} phone={c.phone} />
        ))}
      </ul>
      {vaccines && (
        <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-label text-muted-foreground">
          <Syringe aria-hidden className="size-4 shrink-0" />
          <span>
            <span className="font-mono">{given}</span> of <span className="font-mono">{vaccines.length}</span> vaccine doses given
            {nextVaccine ? `, next ${nextVaccine.name}` : ""}
          </span>
        </p>
      )}
    </section>
  );
}

function Contact({ icon, name, sub, phone }: { icon: React.ReactNode; name: string; sub?: string; phone?: string }) {
  const body = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label font-medium">{name}</span>
        <span className="block truncate text-caption text-muted-foreground">{sub}</span>
      </span>
      {phone && <span className="font-mono text-label text-foreground">{phone}</span>}
    </>
  );
  return (
    <li>
      {phone ? (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="flex min-h-11 items-center gap-3 rounded-xl px-1 transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {body}
        </a>
      ) : (
        <div className="flex min-h-11 items-center gap-3 px-1">{body}</div>
      )}
    </li>
  );
}
