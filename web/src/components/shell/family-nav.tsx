"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Route, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Only screens that work are listed (organizer rule: hide what does not work).
// Add an entry here when its route lands.
const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "", label: "This week", icon: CalendarCheck },
  { href: "/journey", label: "Journey", icon: Route },
  // enable when the API lands (#175): { href: "/directory", label: "Find help", icon: Users },
];

export function FamilyNav({ memberId }: { memberId: string }) {
  const pathname = usePathname();
  const base = `/family/${memberId}`;
  return (
    <nav aria-label="Family" className="flex gap-1 md:flex-col">
      {items.map((item) => {
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
