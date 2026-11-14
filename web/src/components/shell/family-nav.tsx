"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarDays, Route, Target, type LucideIcon } from "lucide-react";
import { canOpen, isCaregiver, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

// Only screens that work are listed (organizer rule: hide what does not work).
// Add an entry here when its route lands.
// Each role sees only the screens canOpen() allows (lib/roles.ts).
const items: { href: string; screen: string; label: string; icon: LucideIcon }[] = [
  { href: "", screen: "", label: "This week", icon: CalendarCheck },
  { href: "/journey", screen: "journey", label: "Journey", icon: Route },
  { href: "/calendar", screen: "calendar", label: "Calendar", icon: CalendarDays },
  { href: "/simulator", screen: "simulator", label: "Practice", icon: Target },
  // Enable when the API lands (#174; also import Brain from lucide-react). The route /family/[memberId]/care exists.
  // { href: "/care", label: "Care", icon: Brain },
  // Enable when the API lands (#172): { href: "/passport", label: "Passport", icon: IdCard },
  // enable when the API lands (#175): { href: "/directory", label: "Find help", icon: Users },
];

// hidden: screens whose endpoint answers 501 (not built yet) or refuses this person.
export function FamilyNav({ memberId, role, hidden = [] }: { memberId: string; role: Role; hidden?: string[] }) {
  const pathname = usePathname();
  const base = `/family/${memberId}`;
  return (
    <nav aria-label="Family" className="grid auto-cols-fr grid-flow-col gap-1 md:flex md:flex-col">
      {items.filter((item) => canOpen(role, item.screen) && !hidden.includes(item.screen)).map((item) => {
        const href = base + item.href;
        const active = item.href === "" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-caption font-medium transition-colors duration-150 md:min-h-0 md:flex-row md:justify-start md:gap-2.5 md:px-2.5 md:py-2 md:text-label",
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
