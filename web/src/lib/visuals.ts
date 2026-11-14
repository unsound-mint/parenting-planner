import {
  Baby,
  Backpack,
  Blocks,
  BookOpen,
  Brain,
  ClipboardCheck,
  Droplet,
  Flower2,
  Footprints,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Lock,
  MessagesSquare,
  Milk,
  MoonStar,
  Puzzle,
  Sparkles,
  Sprout,
  Stethoscope,
  Syringe,
  TestTube,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PlanCategory, PlanItemStatus, ProviderType, Visibility } from "@/lib/api/types";

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

/** Directory provider types, in the order the filter shows them. */
export const providerTypeIcon: Record<ProviderType, LucideIcon> = {
  perinatal_therapist: Flower2,
  psychologist: MessagesSquare,
  doula: HandHeart,
  lactation_consultant: Droplet,
  sleep_consultant: MoonStar,
  child_therapist: Puzzle,
  tutor: GraduationCap,
};

export const providerTypeLabel: Record<ProviderType, { one: string; many: string }> = {
  perinatal_therapist: { one: "Perinatal therapist", many: "Perinatal therapists" },
  psychologist: { one: "Psychologist", many: "Psychologists" },
  doula: { one: "Doula", many: "Doulas" },
  lactation_consultant: { one: "Lactation consultant", many: "Lactation consultants" },
  sleep_consultant: { one: "Sleep consultant", many: "Sleep consultants" },
  child_therapist: { one: "Child therapist", many: "Child therapists" },
  tutor: { one: "Tutor", many: "Tutors" },
};

export const providerTypes = Object.keys(providerTypeIcon) as ProviderType[];
