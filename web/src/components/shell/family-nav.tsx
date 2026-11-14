"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarDays, Ellipsis, HeartHandshake, IdCard, Route, Search, Target, type LucideIcon } from "lucide-react";
import { canOpen, isCaregiver, type Role } from "@/lib/roles";
import { planIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";

type Item = { href: string; screen: string; label: string; icon: LucideIcon; /** In the phone bar; the rest sit behind More. */ phone?: boolean };

// Ordered by how often a parent needs them: this week first, then the weekly
// care session, the records they pull up at a visit, the directory, and the
// long view last. Each role sees only the screens canOpen() allows (lib/roles.ts).
const items: Item[] = [
  { href: "", screen: "", label: "This week", icon: CalendarCheck, phone: true },
  { href: "/plan", screen: "plan", label: "Plan", icon: planIcon, phone: true },
  { href: "/care", screen: "care", label: "Care", icon: HeartHandshake, phone: true },
  { href: "/passport", screen: "passport", label: "Passport", icon: IdCard },
  { href: "/directory", screen: "directory", label: "Find help", icon: Search },
  { href: "/journey", screen: "journey", label: "Journey", icon: Route },
  { href: "/calendar", screen: "calendar", label: "Calendar", icon: CalendarDays, phone: true },
  { href: "/simulator", screen: "simulator", label: "Practice", icon: Target },
];

// A phone bar fits five entries at 390px without wrapping or scrolling.
const PHONE_SLOTS = 5;

const linkClass = (active: boolean) =>
  cn(
    "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-caption whitespace-nowrap transition-colors duration-150 md:flex-none md:flex-row md:justify-start md:gap-2.5 md:px-2.5 md:py-2 md:text-left md:text-label",
    active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

// hasPlan is false while GET tasks does not answer 200 (501 in production without preview mocks): no Plan entry then.
// hidden: other screens whose endpoint refuses this person (403, 404) or is not built and has no preview mock.
// Phones get one row: the most used entries, then More, which opens the rest in place.
export function FamilyNav({ memberId, role, hasPlan, hidden = [] }: { memberId: string; role: Role; hasPlan: boolean; hidden?: string[] }) {
  const pathname = usePathname();
  // Open for one path only, so the panel closes after navigating.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const moreOpen = openAt === pathname;
  const base = `/family/${memberId}`;
  const visible = items.filter((item) => canOpen(role, item.screen) && (item.screen !== "plan" || hasPlan) && !hidden.includes(item.screen));
  const isActive = (item: Item) => (item.href === "" ? pathname === base : pathname.startsWith(base + item.href));
  const label = (item: Item) => (item.href === "" && isCaregiver(role) ? "Baby's care" : item.label);
  const fits = visible.length <= PHONE_SLOTS;
  const bar = fits ? visible : visible.filter((i) => i.phone).slice(0, PHONE_SLOTS - 1);
  const more = fits ? [] : visible.filter((i) => !bar.includes(i));
  const moreActive = more.some(isActive);

  const link = (item: Item, className?: string) => (
    <Link key={item.href} href={base + item.href} aria-current={isActive(item) ? "page" : undefined} className={cn(linkClass(isActive(item)), className)}>
      <item.icon className="size-4.5 shrink-0" aria-hidden />
      {label(item)}
    </Link>
  );

  return (
    <nav aria-label="Family">
      <div className="hidden flex-col gap-1 md:flex">{visible.map((item) => link(item))}</div>
      <div className="flex gap-1 md:hidden">
        {bar.map((item) => link(item))}
        {more.length > 0 && (
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="nav-more"
            onClick={() => setOpenAt(moreOpen ? null : pathname)}
            className={linkClass(moreActive || moreOpen)}
          >
            <Ellipsis className="size-4.5 shrink-0" aria-hidden />
            More
          </button>
        )}
      </div>
      {more.length > 0 && (
        <div
          id="nav-more"
          inert={!moreOpen}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out) md:hidden",
            moreOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-1 grid grid-cols-4 gap-1 border-t border-border pt-2">{more.map((item) => link(item))}</div>
          </div>
        </div>
      )}
    </nav>
  );
}
