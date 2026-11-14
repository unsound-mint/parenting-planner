import Link from "next/link";
import { Lock } from "lucide-react";
import type { PassportPerson } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const tint = (p: PassportPerson) =>
  p.kind === "child" ? "bg-status-ok-soft text-status-ok" : p.role === "mother" ? "bg-mom/15 text-mom" : "bg-partner/15 text-partner";

// One tab per person, as links so the choice lives in the URL (?person=<id>) and needs no client JS.
export function PersonTabs({ people, selectedId, base }: { people: PassportPerson[]; selectedId: string; base: string }) {
  return (
    <nav aria-label="Whose passport" className="flex flex-wrap gap-2">
      {people.map((p) => {
        const active = p.id === selectedId;
        return (
          <Link
            key={p.id}
            href={`${base}?person=${p.id}`}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 transition-colors duration-150",
              active ? "border-foreground/20 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("flex size-8 items-center justify-center rounded-full text-label font-semibold", tint(p))} aria-hidden>
              {initials(p.name)}
            </span>
            <span className="text-label font-medium">{p.isActingParent ? "You" : p.name}</span>
            {p.kind === "parent" && !p.isActingParent && <Lock className="size-3.5" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}
