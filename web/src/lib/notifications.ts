import { Bell, CalendarClock, ClipboardList, CreditCard, FlaskConical, Handshake, Heart, Hospital, ListChecks, UserCheck, UsersRound, type LucideIcon } from "lucide-react";
import type { Notification, NotificationKind } from "@/lib/api/types";
import { canOpen, type Role } from "@/lib/roles";

// Where each kind is acted on, and how it looks in the bell. The API sends a kind
// and an entity id; the screens below have no per-record page yet, so the link
// opens the screen that lists the record. A person who may not open that screen
// (a caregiver) lands on their home instead of a page that refuses them.
export const notificationTarget: Record<NotificationKind, { screen: string; icon: LucideIcon; tint: string }> = {
  task_offered: { screen: "plan", icon: ListChecks, tint: "bg-secondary text-secondary-foreground" },
  task_offer_answered: { screen: "plan", icon: UserCheck, tint: "bg-status-ok-soft text-status-ok" },
  handoff_received: { screen: "care", icon: Handshake, tint: "bg-status-due-soft text-status-due" },
  handoff_accepted: { screen: "care", icon: Handshake, tint: "bg-status-ok-soft text-status-ok" },
  plan_item_due: { screen: "plan", icon: ClipboardList, tint: "bg-status-due-soft text-status-due" },
  value_flagged: { screen: "passport", icon: FlaskConical, tint: "bg-status-due-soft text-status-due" },
  appointment_reminder: { screen: "calendar", icon: CalendarClock, tint: "bg-status-up-soft text-status-up" },
  invitation_accepted: { screen: "people", icon: UsersRound, tint: "bg-status-ok-soft text-status-ok" },
  labour_started: { screen: "hospital", icon: Hospital, tint: "bg-status-due-soft text-status-due" },
  // Love lands on This week, where the parents see who sent it.
  love_sent: { screen: "", icon: Heart, tint: "bg-mom-soft text-mom" },
  subscription_started: { screen: "/pricing", icon: CreditCard, tint: "bg-status-ok-soft text-status-ok" },
};

export const fallbackNotificationIcon = Bell;

/** The link for one notification, for the person who is reading it. */
export function notificationHref(n: Pick<Notification, "kind">, memberId: string, role: Role): string {
  const base = `/family/${memberId}`;
  const screen = notificationTarget[n.kind]?.screen;
  if (!screen) return base;
  if (screen.startsWith("/")) return screen;
  return canOpen(role, screen) ? `${base}/${screen}` : base;
}

/** "25 min ago", "3 h ago", "4 d ago": how long ago, for a list that is read at a glance. */
export function agoWords(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (60 * 24))} d ago`;
}
