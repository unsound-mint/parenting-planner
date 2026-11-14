import "server-only";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { inPlanningJournal } from "@/lib/fertility";

/**
 * Opens the planning screens for a parent. Caregivers are sent home, a family that
 * is not planning (or is in pregnancy loss support) goes back to Journal and care.
 */
export async function planningContext(memberId: string) {
  await requireParent(memberId);
  const api = await serverApi();
  const { data: family } = await api.GET("/family");
  if (!family) notFound();
  if (!inPlanningJournal(family)) redirect(`/family/${memberId}/care`);
  const me = family.parents.find((p) => p.id === memberId);
  if (!me) redirect("/family");
  const partner = family.parents.find((p) => p.id !== memberId);
  return { api, family, me, partner };
}
