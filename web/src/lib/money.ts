import { Baby, Building2, CalendarOff, Ellipsis, HeartPulse, Hospital, Home, Milk, School, Stethoscope, UserRound, Users, type LucideIcon } from "lucide-react";
import type { BudgetCategory, BudgetPayer, ChildcareKind, ChildcareStatus } from "@/lib/api/types";

/** Whole dollars, "$1,234". The API speaks cents; the screen never shows them. */
export const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

export const categoryMeta: Record<BudgetCategory, { label: string; icon: LucideIcon }> = {
  pregnancy_care: { label: "Pregnancy care", icon: HeartPulse },
  delivery: { label: "Delivery", icon: Hospital },
  equipment: { label: "Gear", icon: Baby },
  childcare: { label: "Childcare", icon: School },
  leave: { label: "Leave", icon: CalendarOff },
  food: { label: "Diapers and feeding", icon: Milk },
  health: { label: "Baby health", icon: Stethoscope },
  other: { label: "Other", icon: Ellipsis },
};

export const categories = Object.keys(categoryMeta) as BudgetCategory[];

/** Tailwind colour per payer: each parent's own accent, neutral for shared. */
export const payerBg: Record<BudgetPayer, string> = { mother: "bg-mom", partner: "bg-partner", shared: "bg-muted-foreground/45" };

export const childcareKindMeta: Record<ChildcareKind, { label: string; icon: LucideIcon }> = {
  center: { label: "Daycare center", icon: Building2 },
  home_based: { label: "Home daycare", icon: Home },
  nanny: { label: "Nanny", icon: UserRound },
  family: { label: "Family helps", icon: Users },
};

export const childcareStatuses: ChildcareStatus[] = ["inquiring", "toured", "waitlisted", "applied", "accepted", "declined"];

export const childcareStatusLabel: Record<ChildcareStatus, string> = {
  inquiring: "Asked",
  toured: "Toured",
  waitlisted: "On waitlist",
  applied: "Applied",
  accepted: "Got a spot",
  declined: "Passed",
};

/** Dollars typed in a field to cents; NaN and negatives become 0. */
export const toCents = (v: string) => {
  const n = Math.round(parseFloat(v.replace(/[^0-9.]/g, "")) * 100);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
export const toDollarsField = (cents: number) => String(Math.round(cents / 100));
