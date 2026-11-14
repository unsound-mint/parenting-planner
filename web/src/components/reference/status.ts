import { Ban, Check, CircleAlert, MessageCircleQuestionMark, type LucideIcon } from "lucide-react";
import type { SafetyEntry } from "@/lib/api/types";

export type Status = SafetyEntry["pregnancy"]["status"];

// Calm on purpose: nothing here is red. Avoid is clay, the same colour the
// plan uses for overdue; red stays with Urgent help.
export const statusLook: Record<Status, { label: string; icon: LucideIcon; badge: string; ring: string }> = {
  ok: { label: "Generally considered OK", icon: Check, badge: "bg-status-ok-soft text-status-ok", ring: "ring-status-ok/25" },
  limit: { label: "Limit or take care", icon: CircleAlert, badge: "bg-status-due-soft text-status-due", ring: "ring-status-due/25" },
  avoid: { label: "Generally advised against", icon: Ban, badge: "bg-status-late-soft text-status-late", ring: "ring-status-late/25" },
  ask: { label: "Ask your clinician or pharmacist", icon: MessageCircleQuestionMark, badge: "bg-status-up-soft text-status-up", ring: "ring-status-up/25" },
};
