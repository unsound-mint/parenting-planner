"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
import { relativePath, tabFor, visibleTabs } from "@/lib/sections";
import { cn } from "@/lib/utils";

type Props = { memberId: string; role: Role; hidden?: string[]; childName?: string };

/**
 * The tab row above every page in a section (lib/sections.ts): where you are and
 * what sits beside it. The family layout renders it once, so pages do not. It shows
 * nothing on This week, Privacy and Settings, or when a person can open only one tab.
 */
export function SectionTabs({ memberId, role, hidden = [], childName }: Props) {
  const pathname = usePathname();
  const base = `/family/${memberId}`;
  const here = tabFor(relativePath(pathname, memberId));
  const tabs = here ? visibleTabs(here.section, role, hidden) : [];
  const row = useRef<HTMLDivElement>(null);
  const activeId = here?.tab.id;

  // On a phone the row scrolls sideways: bring the current tab into view without moving the page.
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (row.current && el && (el.offsetLeft < row.current.scrollLeft || el.offsetLeft + el.offsetWidth > row.current.scrollLeft + row.current.clientWidth)) {
      row.current.scrollLeft = el.offsetLeft - 16;
    }
  }, [activeId]);

  if (!here || tabs.length < 2) return null;
  return (
    <nav aria-label={here.section.label} className="print:hidden px-4 md:px-8">
      <div ref={row} className="relative -mx-4 flex gap-5 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] md:mx-0 md:gap-7 md:px-0 [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const on = t.id === activeId;
          return (
            <Link
              key={t.id}
              href={base + t.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 shrink-0 items-center text-label font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:text-foreground focus-visible:underline",
                "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors after:duration-150",
                on ? "text-ink after:bg-me" : "text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-line-2",
              )}
            >
              {t.id === "baby" && childName ? childName : t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
