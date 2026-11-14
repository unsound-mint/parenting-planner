import "server-only";
import { serverApi } from "@/lib/api/server";

/**
 * The acting parent's "Essentials only" setting (GET /members/{id}/preferences).
 * Screens that show detailed tracking (care log details, charts, per-day counts)
 * call this and hide the detail when it is true. False when the call fails, so a
 * missing answer never hides anything.
 */
export async function getEssentialsOnly(memberId: string): Promise<boolean> {
  const api = await serverApi();
  const { data } = await api.GET("/members/{memberId}/preferences", { params: { path: { memberId } } });
  return data?.essentialsOnly ?? false;
}
