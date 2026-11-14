"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Route, type LucideIcon } from "lucide-react";
import { canOpen, isCaregiver, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

// Only screens that work are listed (organizer rule: hide what does not work).
// Add an entry here when its route lands.
// Each role sees only the screens canOpen() allows (lib/roles.ts).
const items: { href: string; screen: string; label: string; icon: LucideIcon }[] = [
  { href: "", screen: "", label: "This week", icon: CalendarCheck },
  { href: "/journey", screen: "journey", label: "Journey", icon: Route },
];

export function FamilyNav({ memberId, role }: { memberId: string; role: Role }) {
  const pathname = usePathname();
  const base = `/family/${memberId}`;
  return (
    <nav aria-label="Family" className="flex gap-1 md:flex-col">
      {items.filter((item) => canOpen(role, item.screen)).map((item) => {
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
