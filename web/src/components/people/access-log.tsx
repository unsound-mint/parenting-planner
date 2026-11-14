import { Eye, Handshake, IdCard, Milk, MailPlus, type LucideIcon } from "lucide-react";
import type { AccessLogEntry } from "@/lib/api/types";
import { agoWords } from "@/lib/care";

const entityIcon: Record<string, LucideIcon> = {
  child_passport: IdCard,
  care_log_entry: Milk,
  care_log: Milk,
  handoff: Handshake,
  invitation: MailPlus,
};

const entityWords: Record<string, string> = {
  child_passport: "the baby card",
  care_log_entry: "a care log entry",
  care_log: "the care log",
  handoff: "a handoff",
  invitation: "an invitation",
};

const actionWords: Record<string, string> = {
  read: "looked at",
  create: "added",
  update: "changed",
  delete: "removed",
  accept: "accepted",
  revoke: "revoked",
};

function sentence(e: AccessLogEntry): string {
  const what = entityWords[e.entity] ?? e.entity.replaceAll("_", " ");
  return `${e.actorName} ${actionWords[e.action] ?? e.action} ${what}`;
}

// What caregivers read or changed, newest first. Shown to parents only.
export function AccessLog({ items, now }: { items: AccessLogEntry[]; now: Date }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="access-title" className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 id="access-title" className="flex items-center gap-2 text-title">
        <Eye aria-hidden className="size-4.5 text-muted-foreground" />
        Who looked at what
      </h2>
      <ul className="mt-3 flex flex-col">
        {items.slice(0, 8).map((e) => {
          const Icon = entityIcon[e.entity] ?? Eye;
          return (
            <li key={e.id} className="flex min-h-11 items-center gap-3 border-t border-border py-2 first:border-t-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-label">{sentence(e)}</span>
              <span className="shrink-0 font-mono text-caption text-muted-foreground">{agoWords(e.at, now)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
