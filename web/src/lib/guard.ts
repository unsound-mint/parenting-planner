import "server-only";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyPeople, isCaregiver } from "@/lib/roles";

/**
 * Call at the top of every screen a grandparent or nanny may not open
 * (lib/roles.ts). The layout cannot do this: it does not see the child segment
 * and does not re-render on client navigation, so each page asks for itself.
 * A caregiver who opens such a URL lands on their own home.
 */
export async function requireParent(memberId: string): Promise<void> {
  const api = await serverApi();
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) redirect("/");
  const person = family && familyPeople(family).find((p) => p.id === memberId);
  // A member of another family (an old tab after a new session): open the current one.
  if (!person) redirect("/family");
  if (isCaregiver(person.role)) redirect(`/family/${memberId}`);
}
