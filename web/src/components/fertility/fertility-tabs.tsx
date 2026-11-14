"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart, ListChecks, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

/** The three planning screens, one row: the journal, the readiness checklist, the appointments. */
export function FertilityTabs({ memberId }: { memberId: string }) {
  const base = `/family/${memberId}/care/fertility`;
  const pathname = usePathname();
  const tabs = [
    { href: base, label: "Cycle journal", icon: NotebookPen },
    { href: `${base}/readiness`, label: "Getting ready", icon: ListChecks },
    { href: `${base}/appointments`, label: "Appointments", icon: CalendarHeart },
  ];
  return (
    <nav aria-label="Planning" className="flex flex-wrap gap-2">
      {tabs.map(({ href, label, icon: Icon }) => {
        const on = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn("press inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9", on ? "border-ink bg-ink text-paper" : "border-line bg-card text-muted-foreground hover:bg-muted")}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
