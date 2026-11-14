import { BookOpen, CalendarHeart, CheckSquare, Target, type LucideIcon } from "lucide-react";
import type { AnalyticsMetric, ContentKind, DemoTemplate, Stage } from "@/lib/api/types";

export const contentKinds: { id: ContentKind; label: string; icon: LucideIcon; bodyLabel: string }[] = [
  { id: "pregnancy_week", label: "Weekly cards", icon: CalendarHeart, bodyLabel: "Development" },
  { id: "guide", label: "Lessons", icon: BookOpen, bodyLabel: "Summary" },
  { id: "simulator_question", label: "Practice questions", icon: Target, bodyLabel: "Prompt" },
  { id: "checklist_item", label: "Checklists", icon: CheckSquare, bodyLabel: "Detail" },
];

export const metricLabel: Record<AnalyticsMetric, string> = {
  demo_started: "Demos started",
  custom_family_started: "Custom families",
  task_created: "Tasks created",
  task_done: "Tasks done",
  handoff_created: "Handoffs",
  care_log_entry_created: "Care log entries",
  simulator_round_played: "Practice rounds",
  booking_requested: "Bookings requested",
  invitation_accepted: "Invitations accepted",
  checkout_started: "Checkouts started",
  checkout_paid: "Checkouts paid",
  partner_offer_clicked: "Offer clicks",
};

export const templateLabel: Record<DemoTemplate, string> = {
  planning: "Planning",
  pregnancy: "Pregnancy",
  newborn: "Newborn",
  preschool: "Preschool",
  custom: "Custom",
};

export const offerStages: { id: Stage; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "trying", label: "Trying" },
  { id: "pregnancy", label: "Pregnancy" },
  { id: "postpartum", label: "Newborn" },
  { id: "infant", label: "First year" },
  { id: "toddler", label: "Toddler" },
  { id: "preschool", label: "Preschool" },
  { id: "school_age", label: "School age" },
];
