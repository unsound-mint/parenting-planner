import { Suspense } from "react";
import { serverApi } from "@/lib/api/server";
import type { PlanItem, Tier, WeeklyPlan } from "@/lib/api/types";
import { PAYWALL_LOCKS } from "@/lib/features";
import { attachNote } from "@/lib/week";
import { CalmList, type CalmRow } from "./calm-list";

type Props = { memberId: string; rows: CalmRow[]; items: PlanItem[]; tier?: Tier; footer?: React.ReactNode };

// The calm list renders at once; the written weekly note (slower: an AI call,
// missing while it is 501 or failing) streams in after and only adds its line
// to the "Why" of the items it talks about. A fallback note only echoes the
// rule plan, so it adds nothing (attachNote drops it).
export function CalmSlot(props: Props) {
  return (
    <Suspense fallback={<CalmList memberId={props.memberId} rows={props.rows} footer={props.footer} />}>
      <WithNote {...props} />
    </Suspense>
  );
}

async function WithNote({ memberId, rows, items, tier, footer }: Props) {
  // The written note is a Plus feature once locks are on.
  if (PAYWALL_LOCKS && tier === "free") return <CalmList memberId={memberId} rows={rows} footer={footer} />;
  let plan: WeeklyPlan | undefined;
  try {
    const api = await serverApi();
    plan = (await api.GET("/members/{memberId}/weekly-plan", { params: { path: { memberId } } })).data;
  } catch {
    plan = undefined;
  }
  const note = attachNote(items, plan);
  const withNote = note ? rows.map((r) => (r.kind === "plan" && note.byRule[r.ruleId] ? { ...r, note: note.byRule[r.ruleId].text } : r)) : rows;
  return <CalmList memberId={memberId} rows={withNote} footer={footer} />;
}
