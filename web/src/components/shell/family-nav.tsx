"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Only screens that work are listed (organizer rule: hide what does not work).
// Add an entry here when its route lands.
const items = [{ href: "", label: "This week" }, { href: "/journey", label: "Journey" }];

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
              "rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-150",
              active ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
