"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, BookOpen, CalendarDays, Ellipsis, IdCard, NotebookPen, Route, ShieldCheck, Sprout, Target, UsersRound, X, type LucideIcon } from "lucide-react";
import { canOpen, isCaregiver, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Group = "main" | "more";
type Item = {
  href: string;
  screen: string;
  label: string;
  icon: LucideIcon;
  group: Group;
  /** Phone tab label when the full one does not fit. */
  short?: string;
  /** Shown only when this screen is not in the nav: the screen that normally links to it is missing. */
  fallbackFor?: string;
};

// Three daily screens, then the records. Plan, Journey, Practice, Find help and
// Privacy are reached from inside a screen (This week, Learn, Journal and care,
// People), so they appear here only as a fallback when that screen is missing:
// caregivers cannot open Learn or People, and Learn is hidden in loss support.
// Each role sees only the screens canOpen() allows (lib/roles.ts).
const items: Item[] = [
  { href: "", screen: "", label: "This week", icon: Sprout, group: "main" },
  { href: "/learn", screen: "learn", label: "Learn", icon: BookOpen, group: "main" },
  { href: "/journey", screen: "journey", label: "Journey", icon: Route, group: "main", fallbackFor: "learn" },
  { href: "/care", screen: "care", label: "Journal and care", short: "Journal", icon: NotebookPen, group: "main" },
  { href: "/calendar", screen: "calendar", label: "Calendar", icon: CalendarDays, group: "more" },
  { href: "/baby", screen: "baby", label: "Baby", icon: Baby, group: "more" },
  { href: "/passport", screen: "passport", label: "Baby passport", short: "Passport", icon: IdCard, group: "more" },
  { href: "/people", screen: "people", label: "People", icon: UsersRound, group: "more" },
  { href: "/simulator", screen: "simulator", label: "Practice", icon: Target, group: "more", fallbackFor: "learn" },
  { href: "/settings", screen: "settings", label: "Privacy", icon: ShieldCheck, group: "more", fallbackFor: "people" },
];

// The phone bar holds four tabs at 390 px: the daily screens and More.
const PHONE_SLOTS = 4;

type NavProps = { memberId: string; role: Role; hidden?: string[]; childName?: string };

// hidden: screens whose endpoint refuses this person (403, 404) or is not built and has no preview mock.
function useNav({ memberId, role, hidden = [], childName }: NavProps) {
  const pathname = usePathname();
  const base = `/family/${memberId}`;
  const allowed = (item: Item) => canOpen(role, item.screen) && !hidden.includes(item.screen);
  const visible = items.filter((item) => allowed(item) && (!item.fallbackFor || !items.some((i) => i.screen === item.fallbackFor && allowed(i))));
  const isActive = (item: Item) => (item.href === "" ? pathname === base : pathname.startsWith(base + item.href));
  // Past toddler age the Baby screen is the child's own: it carries their name.
  const label = (item: Item) => (item.href === "" && isCaregiver(role) ? "Baby's care" : item.screen === "baby" && childName ? childName : item.label);
  return { pathname, base, visible, isActive, label };
}

/** The desktop side nav: the daily group, a rule, then the records. */
export function FamilyNav(props: NavProps) {
  const { base, visible, isActive, label } = useNav(props);
  return (
    <nav aria-label="Family" className="flex flex-col">
      {(["main", "more"] as const).map((g) => {
        const group = visible.filter((i) => i.group === g);
        return group.length ? (
          <div key={g} className="flex flex-col gap-1 border-line not-first:mt-2.5 not-first:border-t not-first:pt-2.5">
            {group.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={base + item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press flex min-h-11 items-center gap-3 rounded-xl px-3 text-body font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-me-soft text-ink" : "text-ink-2 hover:bg-muted",
                  )}
                >
                  <item.icon className={cn("size-5 shrink-0", active && "text-me")} strokeWidth={1.7} aria-hidden />
                  {label(item)}
                </Link>
              );
            })}
          </div>
        ) : null;
      })}
    </nav>
  );
}

/**
 * The phone tab bar, floating at the bottom: This week, Learn, Journal, More.
 * More opens the rest in a panel above the bar. Rendered outside the page column
 * so `fixed` anchors to the viewport; PageFrame leaves room for it.
 */
export function FamilyTabBar(props: NavProps) {
  const { pathname, base, visible, isActive, label } = useNav(props);
  // Open for one path only, so the panel closes after navigating.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const moreOpen = openAt === pathname;
  const fits = visible.length <= PHONE_SLOTS;
  const bar = fits ? visible : visible.filter((i) => i.group === "main").slice(0, PHONE_SLOTS - 1);
  const more = fits ? [] : visible.filter((i) => !bar.includes(i));
  const moreActive = more.some(isActive);

  const tab = (active: boolean) =>
    cn(
      "press flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-caption font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      active ? "bg-me-soft text-me" : "text-muted-foreground",
    );

  return (
    <nav aria-label="Family" className="print:hidden fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden">
      {more.length > 0 && (
        <div
          id="nav-more"
          inert={!moreOpen}
          className={cn(
            "mb-2 origin-bottom rounded-3xl border border-line bg-card p-2 shadow-[0_12px_32px_rgb(60_40_20/0.14)] backdrop-blur-md transition-[opacity,transform] duration-(--duration-base) ease-(--ease-out)",
            moreOpen ? "opacity-100" : "pointer-events-none translate-y-2 scale-[0.97] opacity-0",
          )}
        >
          <div className="grid grid-cols-3 gap-1">
            {more.map((item) => (
              <Link key={item.href} href={base + item.href} aria-current={isActive(item) ? "page" : undefined} className={cn(tab(isActive(item)), "min-h-16")}>
                <item.icon className="size-5.5 shrink-0" strokeWidth={1.7} aria-hidden />
                {item.short ?? label(item)}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-1 rounded-3xl border border-line bg-card/95 p-2 shadow-[0_8px_24px_rgb(60_40_20/0.10)] backdrop-blur-md">
        {bar.map((item) => (
          <Link key={item.href} href={base + item.href} aria-current={isActive(item) ? "page" : undefined} className={tab(isActive(item))}>
            <item.icon className="size-5.5 shrink-0" strokeWidth={1.7} aria-hidden />
            {item.short ?? label(item)}
          </Link>
        ))}
        {more.length > 0 && (
          <button type="button" aria-expanded={moreOpen} aria-controls="nav-more" onClick={() => setOpenAt(moreOpen ? null : pathname)} className={tab(moreActive || moreOpen)}>
            {moreOpen ? <X className="size-5.5 shrink-0" strokeWidth={1.7} aria-hidden /> : <Ellipsis className="size-5.5 shrink-0" strokeWidth={1.7} aria-hidden />}
            More
          </button>
        )}
      </div>
    </nav>
  );
}
