import { AudioWaveform, Droplet, Milk, Moon, type LucideIcon } from "lucide-react";
import type { FaceExpression } from "@/components/illustrations";
import type { VirtualBabyMode, VirtualBabyNeed, VirtualBabySession } from "@/lib/api/types";

/**
 * How fast the simulated clock runs while the page is open and nothing is
 * waiting: 8 simulated minutes per real second, so an hour passes in about
 * 8 seconds. It never runs in the background and never sends anything.
 */
export const SIM_MINUTES_PER_SECOND = 8;

export const needIcon: Record<VirtualBabyNeed, LucideIcon> = { hungry: Milk, wet: Droplet, sleepy: Moon, fussy: AudioWaveform };
export const needLabel: Record<VirtualBabyNeed, string> = { hungry: "Hungry", wet: "Wet", sleepy: "Sleepy", fussy: "Fussy" };
/** The topic each need practises, for the summary. */
export const needTopic: Record<VirtualBabyNeed, string> = { hungry: "Feeding cues", wet: "Diapers", sleepy: "Safe sleep", fussy: "Soothing" };
export const needExpression: Record<VirtualBabyNeed, FaceExpression> = { hungry: "hungry", wet: "fussy", sleepy: "sleepy", fussy: "fussy" };

export const modeInfo: Record<VirtualBabyMode, { title: string; detail: string; length: string }> = {
  evening: { title: "One evening", detail: "6 pm to midnight. Six moments, about five minutes.", length: "6 simulated hours" },
  challenge: { title: "The 48-hour challenge", detail: "Two days and two nights. Play it in short sittings and pause whenever you like.", length: "48 simulated hours" },
};

/** Minutes after midnight on the simulated clock. */
export function clockAt(session: Pick<VirtualBabySession, "startClock">, minute: number): number {
  return (((session.startClock + Math.floor(minute)) % 1440) + 1440) % 1440;
}

/** Day 1, 2 or 3 of the simulation (the challenge crosses two midnights). */
export function dayAt(session: Pick<VirtualBabySession, "startClock">, minute: number): number {
  return Math.floor((session.startClock + minute) / 1440) + 1;
}

export function formatClock(clock: number): string {
  const h = Math.floor(clock / 60);
  const m = clock % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Night on the simulated clock: 9 pm to 6 am. */
export function isNight(clock: number): boolean {
  return clock < 6 * 60 || clock >= 21 * 60;
}

export function needLevel(need: { since: number; every: number }, minute: number): number {
  return Math.min(1, Math.max(0, (minute - need.since) / need.every));
}

/** The simulated minute the session had reached: its last handled moment. */
export function reachedMinute(session: VirtualBabySession): number {
  return session.moments.at(-1)?.minute ?? 0;
}

export function activeSession(items: readonly VirtualBabySession[]): VirtualBabySession | undefined {
  return items.find((s) => !s.finishedAt);
}
