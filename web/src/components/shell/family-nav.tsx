"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, X } from "lucide-react";
import { isCaregiver, type Role } from "@/lib/roles";
import { relativePath, tabFor, visibleSections, type Section } from "@/lib/sections";
import { cn } from "@/lib/utils";

// Five sections (This week, Plan, Learn, Health, Family), then Privacy and Settings.
// The sections and their tabs live in lib/sections.ts; a section links to the first
// tab this person can open and stays highlighted on every page inside it.
// Each role sees only the screens canOpen() allows (lib/roles.ts).

// The phone bar holds six tabs at 390 px: the five sections and More.
const PHONE_SLOTS = 6;

type NavProps = { memberId: string; role: Role; hidden?: string[]; childName?: string };
type Item = { section: Section; href: string };

// hidden: screens whose endpoint refuses this person (403, 404) or is not built and has no
// preview mock, plus tab ids that do not apply at this stage (hiddenTabs in layout.tsx).
function useNav({ memberId, role, hidden = [] }: NavProps) {
  const pathname = usePathname();
  const base = `/family/${memberId}`;
  const visible: Item[] = visibleSections(role, hidden).map(({ section, tabs }) => ({ section, href: base + tabs[0].href }));
  const current = tabFor(relativePath(pathname, memberId))?.section.id;
  const isActive = (item: Item) => item.section.id === current;
  const label = (item: Item, phone = false) =>
    item.section.id === "week" && isCaregiver(role) ? "Baby's care" : phone ? (item.section.short ?? item.section.label) : item.section.label;
  return { pathname, visible, isActive, label };
}

/** The desktop side nav: the five sections, a rule, then Privacy and Settings. */
export function FamilyNav(props: NavProps) {
  const { visible, isActive, label } = useNav(props);
  return (
    <nav aria-label="Family" className="flex flex-col">
      {(["main", "account"] as const).map((g) => {
        const group = visible.filter((i) => i.section.group === g);
        return group.length ? (
          <div key={g} className="flex flex-col gap-1 border-line not-first:mt-2.5 not-first:border-t not-first:pt-2.5">
            {group.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.section.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press flex min-h-11 items-center gap-3 rounded-xl px-3 text-body font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-me-soft text-ink" : "text-ink-2 hover:bg-muted",
                  )}
                >
                  <item.section.icon className={cn("size-5 shrink-0", active && "text-me")} strokeWidth={1.7} aria-hidden />
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
 * The phone tab bar, floating at the bottom: the sections and More.
 * More opens the rest (Privacy, Settings) in a panel above the bar. Rendered outside the page column
 * so `fixed` anchors to the viewport; PageFrame leaves room for it.
 */
export function FamilyTabBar(props: NavProps) {
  const { pathname, visible, isActive, label } = useNav(props);
  // Open for one path only, so the panel closes after navigating.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const moreOpen = openAt === pathname;
  const fits = visible.length <= PHONE_SLOTS;
  const bar = fits ? visible : visible.filter((i) => i.section.group === "main").slice(0, PHONE_SLOTS - 1);
  const more = fits ? [] : visible.filter((i) => !bar.includes(i));
  const moreActive = more.some(isActive);

  const tab = (active: boolean) =>
    cn(
      "press flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-caption font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      active ? "bg-me-soft text-me" : "text-muted-foreground",
    );

  // The nav box spans the closed More panel too; only the bar and the open panel take taps, so
  // the band above the bar never swallows a tap meant for the page.
  return (
    <nav aria-label="Family" className="print:hidden pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden">
      {more.length > 0 && (
        <div
          id="nav-more"
          inert={!moreOpen}
          className={cn(
            "mb-2 origin-bottom rounded-3xl border border-line bg-card p-2 shadow-[0_12px_32px_rgb(60_40_20/0.14)] backdrop-blur-md transition-[opacity,transform] duration-(--duration-base) ease-(--ease-out)",
            moreOpen ? "pointer-events-auto opacity-100" : "pointer-events-none translate-y-2 scale-[0.97] opacity-0",
          )}
        >
          <div className="grid grid-cols-3 gap-1">
            {more.map((item) => (
              <Link key={item.section.id} href={item.href} aria-current={isActive(item) ? "page" : undefined} className={cn(tab(isActive(item)), "min-h-16")}>
                <item.section.icon className="size-5.5 shrink-0" strokeWidth={1.7} aria-hidden />
                {label(item, true)}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="pointer-events-auto flex gap-1 rounded-3xl border border-line bg-card/95 p-2 shadow-[0_8px_24px_rgb(60_40_20/0.10)] backdrop-blur-md">
        {bar.map((item) => (
          <Link key={item.section.id} href={item.href} aria-current={isActive(item) ? "page" : undefined} className={tab(isActive(item))}>
            <item.section.icon className="size-5.5 shrink-0" strokeWidth={1.7} aria-hidden />
            {label(item, true)}
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
