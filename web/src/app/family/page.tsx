import { Suspense } from "react";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";

// /family has no screen of its own: open the family as the mother, or as the
// first parent if there is none. The acting parent lives in the URL.
export default function FamilyIndex() {
  return (
    <Suspense fallback={<p className="p-10 text-muted-foreground">Opening your family...</p>}>
      <OpenFirstParent />
    </Suspense>
  );
}

async function OpenFirstParent(): Promise<never> {
  const api = await serverApi();
  const { data: family } = await api.GET("/family");
  if (!family) redirect("/");
  const parent = family.parents.find((p) => p.role === "mother") ?? family.parents[0];
  if (!parent) redirect("/");
  redirect(`/family/${parent.id}`);
}
