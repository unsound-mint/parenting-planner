import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { PageFrame } from "@/components/shell/page";
import { CapsuleBoard } from "@/components/capsule/capsule-board";

// The time capsule: letters to the child, sealed until a chosen date. It sits
// under Baby (and is linked from Learn while there is no child yet). Parents only.
export default function LettersPage({ params }: PageProps<"/family/[memberId]/baby/letters">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Letters params={params} />
    </Suspense>
  );
}

async function Letters({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const [family, letters] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/letters", { params: { path: { memberId } } })]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !letters.data) notFound();
  const me = family.data.parents.find((p) => p.id === memberId);
  if (!me) notFound();
  const them = family.data.parents.find((p) => p.id !== memberId);
  const child = family.data.children[0];
  return (
    <PageFrame className="gap-8">
      <CapsuleBoard
        key={memberId}
        memberId={memberId}
        me={me}
        them={them}
        childName={child?.name}
        childId={child?.id}
        // Age-based dates count from the birth, or from the due date while the baby is on the way.
        origin={child?.birthDate ?? family.data.dueDate}
        initialLetters={letters.data.items}
      />
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-56 animate-pulse rounded-[2rem] bg-muted" />
      <div className="h-48 animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
