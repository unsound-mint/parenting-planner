"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, CalendarCheck, IdCard, Route, Users, type LucideIcon } from "lucide-react";
import { canOpen, isCaregiver, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

// Ordered by how often a parent needs them: this week first, then the weekly
// care session, the records they pull up at a visit, the directory, and the
// long view last. Each role sees only the screens canOpen() allows (lib/roles.ts).
const items: { href: string; screen: string; label: string; icon: LucideIcon }[] = [
  { href: "", screen: "", label: "This week", icon: CalendarCheck },
  { href: "/care", screen: "care", label: "Care", icon: Brain },
  { href: "/passport", screen: "passport", label: "Passport", icon: IdCard },
  { href: "/directory", screen: "directory", label: "Find help", icon: Users },
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
              "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-caption transition-colors duration-150 md:flex-none md:flex-row md:justify-start md:gap-2.5 md:px-2.5 md:py-2 md:text-left md:text-label",
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
