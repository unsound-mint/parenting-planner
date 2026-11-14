import type { CareTeamMember } from "@/lib/api/types";
import { careRoleIcon, careRoleLabel, passportIcon } from "@/lib/visuals";
import { EmptyLine, SectionCard } from "./section-card";
import { initials } from "./person-tabs";

export function CareTeamCard({ members }: { members: CareTeamMember[] }) {
  return (
    <SectionCard id="care-title" icon={passportIcon.careTeam} title="Care team">
      {members.length === 0 ? (
        <EmptyLine>No doctors or clinics added yet.</EmptyLine>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((m) => {
            const Icon = careRoleIcon[m.role];
            return (
              <li key={m.id} className="flex items-center gap-3">
                <span className="relative shrink-0">
                  <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-label font-semibold text-secondary-foreground" aria-hidden>
                    {initials(m.name)}
                  </span>
                  <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-card bg-status-up-soft text-status-up">
                    <Icon className="size-3" aria-hidden />
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body font-medium">{m.name}</p>
                  <p className="truncate text-label text-muted-foreground">
                    {careRoleLabel[m.role]} · {m.clinic}
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
