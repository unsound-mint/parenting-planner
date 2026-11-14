import {
  Activity,
  Baby,
  Backpack,
  Blocks,
  BookOpen,
  Brain,
  ClipboardCheck,
  Footprints,
  HeartHandshake,
  HeartPulse,
  Lock,
  MessageCircleHeart,
  Milk,
  Sparkles,
  Sprout,
  Stethoscope,
  Syringe,
  TestTube,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PlanCategory, PlanItemStatus, Visibility } from "@/lib/api/types";

// One icon per concept, used the same way on every screen
// (docs/design.md, "Hierarchy and visuals", rule 6).

export const categoryIcon: Record<PlanCategory, LucideIcon> = {
  screening: TestTube,
  vaccine: Syringe,
  visit: Stethoscope,
  mental_health: Brain,
  logistics: ClipboardCheck,
  couple: HeartHandshake,
  learning: BookOpen,
};

export const categoryLabel: Record<PlanCategory, string> = {
  screening: "Screening",
  vaccine: "Vaccine",
  visit: "Visit",
  mental_health: "Mental health",
  logistics: "Logistics",
  couple: "Together",
  learning: "Learning",
};

/** Journey node key (components/journey/stages.ts) to icon. */
export const stageIcon: Record<string, LucideIcon> = {
  planning: Sprout,
  pregnancy: HeartPulse,
  birth: Sparkles,
  newborn: Baby,
  "first-year": Milk,
  toddler: Footprints,
  preschool: Blocks,
  "school-age": Backpack,
};

export const visibilityIcon: Record<Visibility, LucideIcon> = {
  private: Lock,
  partner: HeartHandshake,
  care_team: Stethoscope,
  family: Users,
};

/** Soft tinted circle behind an item icon, by plan status. */
export const statusTint: Record<PlanItemStatus, string> = {
  overdue: "bg-status-late-soft text-status-late",
  due: "bg-status-due-soft text-status-due",
  upcoming: "bg-status-up-soft text-status-up",
};

/** A detected pattern in the parent's own check-ins. */
export const patternIcon = Activity;

/** "Talk to someone": the link from a pattern to the provider directory. */
export const talkIcon = MessageCircleHeart;
