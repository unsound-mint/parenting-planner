import { Suspense } from "react";
import { serverApi } from "@/lib/api/server";
import type { PlanItem, Tier, WeeklyPlan } from "@/lib/api/types";
import { PAYWALL_LOCKS } from "@/lib/features";
import { attachNote } from "@/lib/week";
import { PlanBoard } from "./plan-board";

type Props = { items: PlanItem[]; memberId: string; tier?: Tier; talkHref?: string };

// The rule plan with the written weekly note folded into it. The plan renders
// at once; the note (slower, and missing while its endpoint is 501 or failing)
// streams in after and only changes the lines it talks about. A fallback note
// (fallback: true) only echoes the rule plan, so it adds nothing.
export function PlanWithNote(props: Props) {
  return (
    <Suspense fallback={<PlanBoard items={props.items} memberId={props.memberId} talkHref={props.talkHref} />}>
      <NoteLoader {...props} />
    </Suspense>
  );
}

async function NoteLoader({ items, memberId, tier, talkHref }: Props) {
  let plan: WeeklyPlan | undefined;
  try {
    const api = await serverApi();
    plan = (await api.GET("/members/{memberId}/weekly-plan", { params: { path: { memberId } } })).data;
  } catch {
    plan = undefined;
  }
  const note = attachNote(items, plan);
  // Free plan: one locked row, and only when there is a real note to unlock.
  const locked = PAYWALL_LOCKS && tier === "free" && !!note;
  return <PlanBoard items={items} memberId={memberId} talkHref={talkHref} note={locked ? undefined : note} noteLocked={locked} />;
}
