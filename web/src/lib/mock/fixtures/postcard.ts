import type { Postcard, PostcardLove } from "@/lib/api/types";
import { mock } from "../registry";
import { olderStage } from "../timeline";

// Preview of the weekly postcard while the endpoints answer 501. It follows the
// pregnancy demo (week 25, a zucchini) and keeps the line and the hearts in
// memory per runtime, like the notification mocks. A nanny gets no card (the
// real endpoint answers 403, so the mock returns nothing for her).
const source = { title: "NHS Start for Life: Your baby's development week by week", url: "https://www.nhs.uk/start-for-life/pregnancy/", checkedAt: "2026-11-14" };
const state = new Map<string, { line?: Postcard["line"]; loves: PostcardLove[] }>();

async function build(memberId: string, family: () => Promise<import("@/lib/api/types").Family>): Promise<Postcard | undefined> {
  const f = await family();
  if (olderStage(f) || f.caregivers.some((c) => c.id === memberId && c.role === "nanny")) return undefined;
  const s = state.get(f.id) ?? { loves: [] };
  state.set(f.id, s);
  const parent = f.parents.some((p) => p.id === memberId);
  const loves = parent ? s.loves : s.loves.filter((l) => l.fromName === f.caregivers.find((c) => c.id === memberId)?.displayName);
  const today = new Date().toISOString().slice(0, 10);
  return {
    kind: "pregnancy",
    stage: "pregnancy",
    period: `Week ${f.gestationalWeek ?? 25}`,
    headline: "About the size of a zucchini",
    comparison: "a zucchini",
    detail: "Your baby can hear your voice now and is practicing breathing movements.",
    source,
    line: s.line,
    loves,
    loveSentToday: !parent && loves.some((l) => l.sentAt.startsWith(today)),
  };
}

export const postcardMocks = {
  ...mock("/members/{memberId}/postcard", "get", (ctx) => build(ctx.path.memberId, ctx.family) as Promise<Postcard>),
  ...mock("/members/{memberId}/postcard/line", "put", async (ctx) => {
    const f = await ctx.family();
    const text = ctx.body.text.trim();
    const s = state.get(f.id) ?? { loves: [] };
    s.line = text ? { text, authorName: f.parents.find((p) => p.id === ctx.path.memberId)?.displayName ?? "Parent", updatedAt: new Date().toISOString() } : undefined;
    state.set(f.id, s);
    return (await build(ctx.path.memberId, ctx.family)) as Postcard;
  }, 200),
  ...mock("/members/{memberId}/postcard/love", "post", async (ctx) => {
    const f = await ctx.family();
    const s = state.get(f.id) ?? { loves: [] };
    const from = f.caregivers.find((c) => c.id === ctx.path.memberId)?.displayName ?? "Grandma";
    s.loves = [{ id: crypto.randomUUID(), fromName: from, message: ctx.body?.message || undefined, sentAt: new Date().toISOString() }, ...s.loves].slice(0, 20);
    state.set(f.id, s);
    return (await build(ctx.path.memberId, ctx.family)) as Postcard;
  }, 200),
};
