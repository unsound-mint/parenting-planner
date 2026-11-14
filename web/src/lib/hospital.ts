import type { HospitalBag, Task } from "@/lib/api/types";

export const HOSPITAL_BAGS: HospitalBag[] = ["mother", "partner", "baby"];

/** Packed items over all items across the three bags. */
export function bagProgress(tasks: Task[]): { done: number; total: number } {
  const bag = tasks.filter((t) => t.bag);
  return { done: bag.filter((t) => t.done).length, total: bag.length };
}
