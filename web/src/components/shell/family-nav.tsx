"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, CalendarCheck, CalendarDays, HeartHandshake, IdCard, Route, Search, Target, UsersRound, type LucideIcon } from "lucide-react";
import { canOpen, isCaregiver, type Role } from "@/lib/roles";
import { planIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// Ordered by how often a parent needs them: this week first, then the weekly
// care session, the records they pull up at a visit, the directory, and the
// long view last. Each role sees only the screens canOpen() allows (lib/roles.ts).
const items: { href: string; screen: string; label: string; icon: LucideIcon }[] = [
  { href: "", screen: "", label: "This week", icon: CalendarCheck },
  { href: "/plan", screen: "plan", label: "Plan", icon: planIcon },
  { href: "/care", screen: "care", label: "Care", icon: HeartHandshake },
  { href: "/passport", screen: "passport", label: "Passport", icon: IdCard },
  { href: "/directory", screen: "directory", label: "Find help", icon: Search },
  { href: "/journey", screen: "journey", label: "Journey", icon: Route },
  { href: "/baby", screen: "baby", label: "Baby", icon: Baby },
  { href: "/people", screen: "people", label: "People", icon: UsersRound },
  { href: "/calendar", screen: "calendar", label: "Calendar", icon: CalendarDays },
  { href: "/simulator", screen: "simulator", label: "Practice", icon: Target },
];

// hasPlan is false while GET tasks does not answer 200 (501 in production without preview mocks): no Plan entry then.
// hidden: other screens whose endpoint refuses this person (403, 404) or is not built and has no preview mock.
export function FamilyNav({ memberId, role, hasPlan, hidden = [] }: { memberId: string; role: Role; hasPlan: boolean; hidden?: string[] }) {
  const pathname = usePathname();
  const base = `/family/${memberId}`;
  return (
    <nav aria-label="Family" className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
      {items.filter((item) => canOpen(role, item.screen) && (item.screen !== "plan" || hasPlan) && !hidden.includes(item.screen)).map((item) => {
        const href = base + item.href;
        const active = item.href === "" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 min-w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-caption transition-colors duration-150 md:flex-none md:flex-row md:justify-start md:gap-2.5 md:px-2.5 md:py-2 md:text-left md:text-label",
              active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4.5 shrink-0" aria-hidden />
            {item.href === "" && isCaregiver(role) ? "Baby's care" : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
