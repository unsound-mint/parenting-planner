import Link from "next/link";
import { Heart, UserRound, Users, type LucideIcon } from "lucide-react";
import type { CalendarScope } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const tabs: { scope: CalendarScope; label: string; icon: LucideIcon }[] = [
  { scope: "mine", label: "Mine", icon: UserRound },
  { scope: "partner", label: "Partner", icon: Heart },
  { scope: "family", label: "Family", icon: Users },
];

// Segmented Mine / Partner / Family. Links, so the choice is in the URL and
// survives a reload; the week stays when the scope changes.
export function ScopeTabs({ active, hrefFor }: { active: CalendarScope; hrefFor: (scope: CalendarScope) => string }) {
  return (
    <nav aria-label="Whose calendar" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1 sm:w-80">
      {tabs.map(({ scope, label, icon: Icon }) => (
        <Link
          key={scope}
          href={hrefFor(scope)}
          replace
          aria-current={scope === active ? "true" : undefined}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1.5 rounded-full text-label transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9",
            scope === active ? "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
