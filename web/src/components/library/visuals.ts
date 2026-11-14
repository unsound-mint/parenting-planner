import {
  Apple,
  Baby,
  BookOpen,
  Brain,
  FileText,
  HeartHandshake,
  HeartPulse,
  Home,
  type LucideIcon,
  Moon,
  Scale,
  ShieldCheck,
  Smile,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { LibraryEvidence } from "@/lib/api/types";

// Topic categories come from the research atlas as plain strings, so an
// unknown one falls back to a book rather than breaking the screen.
const categories: Record<string, { label: string; icon: LucideIcon }> = {
  health: { label: "Health", icon: HeartPulse },
  safety: { label: "Safety", icon: ShieldCheck },
  feeding: { label: "Feeding", icon: Apple },
  sleep: { label: "Sleep", icon: Moon },
  development: { label: "Growing", icon: Sparkles },
  behavior: { label: "Behavior", icon: Baby },
  emotions: { label: "Feelings", icon: HeartHandshake },
  "parent-wellbeing": { label: "You", icon: Brain },
  teeth: { label: "Teeth", icon: Smile },
  learning: { label: "Learning", icon: BookOpen },
  social: { label: "Friends", icon: UsersRound },
  family: { label: "Family", icon: Home },
  decisions: { label: "Decisions", icon: Scale },
  admin: { label: "Paperwork", icon: FileText },
};

export const categoryOf = (c: string) => categories[c] ?? { label: c.replace(/-/g, " "), icon: BookOpen };

/** Categories in chip order: the ones parents reach for most first. */
export const categoryOrder = Object.keys(categories);

/**
 * The evidence label as a calm tag. A theory or a popular belief must never
 * read as medical advice, so those say so in words, not just a colour.
 */
export const evidenceTag: Record<LibraryEvidence, { label: string; hint: string; className: string }> = {
  guideline: { label: "Official guidance", hint: "An official health body recommends this.", className: "bg-leaf-soft text-leaf" },
  research: { label: "Research", hint: "Supported by studies; there is no formal guideline.", className: "bg-muted text-ink-2" },
  contested: { label: "Guidance differs", hint: "Official bodies or experts disagree. Both sides are cited.", className: "bg-sun text-ink-2" },
  theory: { label: "A theory, not advice", hint: "A historical idea parents hear about, with what research says today.", className: "bg-muted text-muted-foreground" },
  folk: { label: "Popular belief", hint: "A common belief, and what the evidence shows.", className: "bg-muted text-muted-foreground" },
};

/** Lower-case, accent-free words for search. */
export const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
