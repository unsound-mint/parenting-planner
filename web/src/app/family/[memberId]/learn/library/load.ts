import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { inLossSupport } from "@/lib/loss";
import { buildCatalogue, libraryStage } from "@/components/library/catalogue";

/** The library catalogue for one parent: topics, their family's lessons and coming-soon titles, from the API. */
export async function loadCatalogue(memberId: string) {
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, library, paths] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/library-topics", path),
    api.GET("/members/{memberId}/learning-paths", path),
  ]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !library.data) notFound();
  // Like Learn: after a pregnancy loss the stage library is not offered (the nav hides Learn too).
  if (inLossSupport(family.data)) notFound();
  const stage = libraryStage(paths.data?.stage ?? family.data.stage);
  const items = buildCatalogue({ memberId, topics: library.data.items, upcoming: library.data.upcoming, paths: paths.data?.items ?? [], stage });
  return { items, stage, position: library.data.position };
}
