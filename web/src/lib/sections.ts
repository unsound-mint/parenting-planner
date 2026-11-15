import { BookOpen, HeartPulse, Route, Settings, ShieldCheck, Sprout, UsersRound, type LucideIcon } from "lucide-react";
import { canOpen, type Role, type Screen } from "@/lib/roles";

// Where every family page lives. The side nav, the phone tab bar and the tab row
// at the top of a page (SectionTabs) all read this one list, so a page has a home
// in exactly one section. URLs do not follow the sections: a tab names the route
// it opens and any routes that sit under it (includes), so moving a page between
// sections is an edit here, not a route move.

export type SectionTab = {
  /** Key that the family layout can hide on its own (the hidden.push lines in layout.tsx). */
  id: string;
  label: string;
  /** Path under /family/<memberId>. */
  href: string;
  /** What canOpen() and the layout's unavailable screens check. */
  screen: Screen;
  /** Routes reached from this tab that keep it underlined. */
  includes?: string[];
};

export type Section = {
  id: string;
  label: string;
  /** Phone tab label when the full one does not fit. */
  short?: string;
  icon: LucideIcon;
  group: "main" | "account";
  tabs: SectionTab[];
};

export const sections: Section[] = [
  { id: "week", label: "This week", short: "Week", icon: Sprout, group: "main", tabs: [{ id: "week", label: "This week", href: "", screen: "" }] },
  {
    id: "plan",
    label: "Plan",
    icon: Route,
    group: "main",
    tabs: [
      { id: "plan", label: "Plan", href: "/plan", screen: "plan" },
      { id: "journey", label: "Timeline", href: "/journey", screen: "journey" },
      { id: "calendar", label: "Calendar", href: "/calendar", screen: "calendar", includes: ["/appointments"] },
      { id: "money", label: "Money and paperwork", href: "/money", screen: "money", includes: ["/paperwork"] },
      { id: "hospital", label: "Hospital", href: "/hospital", screen: "hospital" },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    icon: BookOpen,
    group: "main",
    tabs: [
      { id: "learn", label: "Paths", href: "/learn", screen: "learn", includes: ["/learn/names"] },
      { id: "library", label: "Library", href: "/learn/library", screen: "learn" },
      { id: "quizzes", label: "Quizzes", href: "/learn/quizzes", screen: "learn" },
      { id: "simulator", label: "Practice", href: "/simulator", screen: "simulator", includes: ["/learn/virtual-baby"] },
      { id: "reference", label: "Can I eat this?", href: "/learn/reference", screen: "learn" },
      { id: "questions", label: "Questions", href: "/learn/questions", screen: "learn" },
      { id: "stickers", label: "Stickers", href: "/learn/stickers", screen: "learn" },
    ],
  },
  {
    id: "health",
    label: "Health",
    icon: HeartPulse,
    group: "main",
    tabs: [
      // /care is the journal; /care/journal only redirects there.
      { id: "care", label: "Journal", href: "/care", screen: "care", includes: ["/care/journal", "/care/brief", "/care/fertility"] },
      { id: "screening", label: "Check-ins", href: "/care/screening", screen: "care" },
      { id: "recovery", label: "Recovery", href: "/care/recovery", screen: "care" },
      { id: "passport", label: "Health records", href: "/passport", screen: "passport" },
      { id: "directory", label: "Find help", href: "/directory", screen: "directory" },
    ],
  },
  {
    id: "family",
    label: "Family",
    icon: UsersRound,
    group: "main",
    tabs: [
      { id: "people", label: "People", href: "/people", screen: "people" },
      { id: "baby", label: "Baby", href: "/baby", screen: "baby", includes: ["/baby-3d"] },
      { id: "story", label: "Our story", href: "/story", screen: "story", includes: ["/postcard"] },
      { id: "lab", label: "Couple lab", href: "/learn/lab", screen: "learn" },
      { id: "friends", label: "Friends", href: "/people/friends", screen: "people" },
      { id: "missions", label: "Missions", href: "/people/missions", screen: "people" },
    ],
  },
  { id: "privacy", label: "Privacy", icon: ShieldCheck, group: "account", tabs: [{ id: "privacy", label: "Privacy", href: "/privacy", screen: "privacy" }] },
  { id: "settings", label: "Settings", icon: Settings, group: "account", tabs: [{ id: "settings", label: "Settings", href: "/settings", screen: "settings" }] },
];

const covers = (path: string, href: string) => (href === "" ? path === "" : path === href || path.startsWith(href + "/"));

/**
 * The tab a path belongs to: the longest href or include that covers it, so
 * /learn/lab is the Couple lab and not Paths. path is relative to /family/<id> ("" for home).
 */
export function tabFor(path: string): { section: Section; tab: SectionTab } | undefined {
  let best: { section: Section; tab: SectionTab; len: number } | undefined;
  for (const section of sections)
    for (const tab of section.tabs)
      for (const h of [tab.href, ...(tab.includes ?? [])])
        if (covers(path, h) && (!best || h.length > best.len)) best = { section, tab, len: h.length };
  return best && { section: best.section, tab: best.tab };
}

/**
 * hidden: screens and tab ids this person cannot open right now (the layout's
 * unavailable screens plus stage rules such as Recovery before birth).
 */
export function visibleTabs(section: Section, role: Role, hidden: readonly string[]): SectionTab[] {
  return section.tabs.filter((t) => canOpen(role, t.screen) && !hidden.includes(t.screen) && !hidden.includes(t.id));
}

/** Sections with at least one tab this person can open, each linking to its first one. */
export function visibleSections(role: Role, hidden: readonly string[]): { section: Section; tabs: SectionTab[] }[] {
  return sections.map((section) => ({ section, tabs: visibleTabs(section, role, hidden) })).filter((s) => s.tabs.length > 0);
}

/** Path under /family/<memberId> without the prefix: "" for home. */
export function relativePath(pathname: string, memberId: string): string {
  const base = `/family/${memberId}`;
  return pathname.startsWith(base) ? pathname.slice(base.length).replace(/\/$/, "") : pathname;
}
