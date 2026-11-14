import { ShieldCheck } from "lucide-react";
import type { Allergy, CareTeamMember } from "@/lib/api/types";
import { allergyIcon, careRoleIcon, careRoleLabel, passportIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";

function Group({ icon: Icon, title, children }: { icon: typeof ShieldCheck; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h2 className="mb-3 flex items-center gap-2 text-label font-medium text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {title}
      </h2>
      {children}
    </div>
  );
}

const quiet = "inline-flex min-h-8 items-center rounded-full border border-dashed border-border px-3 text-label text-muted-foreground";

// Allergies and care team as chips. Allergy chips match the baby card: a solid
// shield for confirmed, a question mark for suspected, the reaction beside the name.
export function ProfileCard({ allergies, careTeam }: { allergies: Allergy[]; careTeam: CareTeamMember[] }) {
  return (
    <section aria-label="Allergies and care team" className="grid gap-6 rounded-2xl border border-border bg-card p-5 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
      <Group icon={passportIcon.allergies} title="Allergies">
        {allergies.length === 0 ? (
          <p className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-status-ok-soft px-3 text-label font-medium text-status-ok">
            <ShieldCheck aria-hidden className="size-4" />
            No known allergies
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {allergies.map((a) => {
              const Icon = allergyIcon[a.certainty];
              return (
                <li
                  key={a.id}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-label",
                    a.certainty === "confirmed" ? "bg-status-late-soft text-status-late" : "bg-status-due-soft text-status-due",
                  )}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="font-semibold">{a.substance}</span>
                  {a.reaction && <span className="font-normal opacity-80">{a.reaction}</span>}
                  <span className="sr-only">, {a.certainty}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Group>
      <Group icon={passportIcon.careTeam} title="Care team">
        {careTeam.length === 0 ? (
          <p className={quiet}>No doctors or clinics added yet</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {careTeam.map((m) => {
              const Icon = careRoleIcon[m.role];
              return (
                <li key={m.id} title={m.clinic} className="flex min-h-11 max-w-full items-center gap-2.5 rounded-full border border-border bg-background py-1 pr-4 pl-1">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-up-soft text-status-up">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-label leading-4 font-medium">{m.name}</span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {careRoleLabel[m.role]} · {m.clinic}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Group>
    </section>
  );
}
