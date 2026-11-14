import "server-only";
import { cache } from "react";
import { serverApi } from "@/lib/api/server";

/**
 * The acting parent's journey preferences. Screens that show baby content
 * (This week, Learn) call hideBabyContent(memberId) and leave out baby size,
 * baby development and baby names when it is true. Private to that parent:
 * never read it for someone else, and a caregiver has none (the API returns 404,
 * which reads as false). Cached per request.
 */
export const getJourneySettings = cache(async (memberId: string) => {
  try {
    const api = await serverApi();
    const { data } = await api.GET("/members/{memberId}/journey-settings", { params: { path: { memberId } } });
    return data ?? null;
  } catch {
    return null;
  }
});

export async function hideBabyContent(memberId: string): Promise<boolean> {
  return (await getJourneySettings(memberId))?.hideBabyContent ?? false;
}
