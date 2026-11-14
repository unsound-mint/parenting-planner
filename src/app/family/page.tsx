import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getFamilyId } from "@/server/session";
import { getParentView } from "@/server/queries";
import { setStage } from "@/server/actions";
import { ParentPanel } from "@/components/parent-panel";
import { LiveRefresh } from "@/components/live-refresh";

// Split view: both parents side by side so the jury sees one action land on
// the other parent's screen. This is the core of the 90-second demo.
export default function FamilyPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <Suspense fallback={<p>Loading family...</p>}>
        <Family />
      </Suspense>
    </main>
  );
}

async function Family() {
  const familyId = await getFamilyId();
  if (!familyId) redirect("/");
  const mom = getParentView(familyId, "mom");
  const partner = getParentView(familyId, "partner");
  if (!mom || !partner) redirect("/");

  const next = mom.family.stage === "pregnancy" ? "baby_home" : "pregnancy";
  return (
    <>
      <LiveRefresh />
      <div className="mb-6 flex items-center justify-between">
        <p>
          Stage: <strong>{mom.family.stage === "pregnancy" ? "Pregnancy" : `${mom.family.babyName} is home`}</strong>
        </p>
        <form action={setStage.bind(null, next)}>
          <button className="rounded-full border px-4 py-2 text-sm">
            {next === "baby_home" ? "Baby is home" : "Back to pregnancy"}
          </button>
        </form>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <ParentPanel view={mom} />
        <ParentPanel view={partner} />
      </div>
    </>
  );
}
