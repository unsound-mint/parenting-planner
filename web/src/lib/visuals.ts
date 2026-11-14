import {
  Baby,
  Backpack,
  Blocks,
  BookOpen,
  Brain,
  CircleHelp,
  ContactRound,
  HandHeart,
  ClipboardCheck,
  Footprints,
  HeartHandshake,
  HeartPulse,
  Lock,
  Milk,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sparkles,
  Sprout,
  Stethoscope,
  Syringe,
  TestTube,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AllergyCertainty, CareRole, PlanCategory, PlanItemStatus, Visibility } from "@/lib/api/types";

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

export const visibilityLabel: Record<Visibility, string> = {
  private: "Only you",
  partner: "Shared with your partner",
  care_team: "Your care team",
  family: "Whole family",
};

/** Health passport sections. */
export const passportIcon = {
  labs: TestTube,
  vaccines: Syringe,
  allergies: ShieldAlert,
  growth: Ruler,
  careTeam: ContactRound,
} satisfies Record<string, LucideIcon>;

/** Confirmed is a solid shield, suspected a dashed question mark: two shapes, not two colours. */
export const allergyIcon: Record<AllergyCertainty, LucideIcon> = {
  confirmed: ShieldCheck,
  suspected: CircleHelp,
};

export const careRoleIcon: Record<CareRole, LucideIcon> = {
  obstetrician: HeartPulse,
  pediatrician: Baby,
  primary_care: Stethoscope,
  psychologist: Brain,
  lactation_consultant: Milk,
  midwife: HandHeart,
  dentist: Smile,
};

export const careRoleLabel: Record<CareRole, string> = {
  obstetrician: "Obstetrician",
  pediatrician: "Pediatrician",
  primary_care: "Primary care",
  psychologist: "Psychologist",
  lactation_consultant: "Lactation consultant",
  midwife: "Midwife",
  dentist: "Dentist",
};
