"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, CalendarCheck, Route, UsersRound, type LucideIcon } from "lucide-react";
import { canOpen, isCaregiver, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

// Only screens that work are listed (organizer rule: hide what does not work).
// Add an entry here when its route lands.
// Each role sees only the screens canOpen() allows (lib/roles.ts).
const items: { href: string; screen: string; label: string; icon: LucideIcon }[] = [
  { href: "", screen: "", label: "This week", icon: CalendarCheck },
  { href: "/journey", screen: "journey", label: "Journey", icon: Route },
  { href: "/baby", screen: "baby", label: "Baby", icon: Baby },
  { href: "/people", screen: "people", label: "People", icon: UsersRound },
  // Enable when the API lands (#174; also import Brain from lucide-react). The route /family/[memberId]/care exists.
  // { href: "/care", label: "Care", icon: Brain },
  // Enable when the API lands (#172): { href: "/passport", label: "Passport", icon: IdCard },
  // enable when the API lands (#175): { href: "/directory", label: "Find help", icon: Users },
];

// Screens whose endpoint may still answer 501: listed only when the layout saw it work.
const probed = new Set(["baby", "people"]);

export function FamilyNav({ memberId, role, available = [] }: { memberId: string; role: Role; available?: string[] }) {
  const pathname = usePathname();
  const base = `/family/${memberId}`;
  return (
    <nav aria-label="Family" className="flex gap-1 md:flex-col">
      {items.filter((item) => canOpen(role, item.screen) && (!probed.has(item.screen) || available.includes(item.screen))).map((item) => {
        const href = base + item.href;
        const active = pathname === href;
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-label transition-colors duration-150",
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
