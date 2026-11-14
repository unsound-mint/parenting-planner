import { inLossSupport } from "@/lib/loss";
import type { components } from "@/lib/api/schema.gen";
import { mock } from "../registry";
import { CHECKED, isoAt, isoDate, uid } from "./dates";

type ContentItem = components["schemas"]["ContentItem"];
type PartnerOffer = components["schemas"]["PartnerOffer"];
type AnalyticsMetric = components["schemas"]["AnalyticsMetric"];
type Stage = components["schemas"]["Stage"];

const src = (title: string, url: string) => ({ title, url, checkedAt: CHECKED });

const content: ContentItem[] = [
  { kind: "pregnancy_week", id: "week-24", title: "Week 24: the lungs are getting ready", body: "Your baby is about the size of an ear of corn. The air sacs in the lungs are forming and the hearing is sharp enough to notice your voice.", edited: false, source: src("ACOG: How your baby grows", "https://www.acog.org/womens-health/faqs/how-your-baby-grows-during-pregnancy") },
  { kind: "pregnancy_week", id: "week-25", title: "Week 25: a busy week for sleep and kicks", body: "Movements are easier to feel now. Many parents notice a pattern, often after meals or in the evening. Mention anything that feels different at your next visit.", edited: true, updatedAt: isoAt(-1, 15), source: src("ACOG: How your baby grows", "https://www.acog.org/womens-health/faqs/how-your-baby-grows-during-pregnancy") },
  { kind: "pregnancy_week", id: "week-26", title: "Week 26: eyes start to open", body: "Your baby can open and close their eyes. The glucose screening is usually offered between weeks 24 and 28.", edited: false, source: src("ACOG: Gestational diabetes", "https://www.acog.org/womens-health/faqs/gestational-diabetes") },
  { kind: "guide", id: "guide-birth-prep", title: "Getting ready for the birth", body: "A short module on what to pack, when to leave for the hospital and who to call. Print the one-page version for your partner.", edited: false, source: src("ACOG: Labor and delivery", "https://www.acog.org/womens-health/faqs/labor-and-delivery") },
  { kind: "guide", id: "guide-feeding", title: "Feeding in the first week", body: "How often a newborn feeds, what wet diapers tell you and when to call the pediatrician.", edited: false, source: src("AAP: Newborn feeding", "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/default.aspx") },
  { kind: "simulator_question", id: "sim-night-feed", title: "The 3 am feed", body: "Your baby wakes for the second time tonight and your partner is asleep. What do you do first?", edited: false },
  { kind: "simulator_question", id: "sim-fever", title: "A warm forehead", body: "Your six-week-old feels warm. What is the first thing to check, and who do you call?", edited: false },
  { kind: "checklist_item", id: "check-bag-charger", title: "Phone charger with a long cable", body: "Hospital outlets are often far from the bed. Pack a cable of two metres or more.", edited: false },
  { kind: "checklist_item", id: "check-fmla", title: "Tell your employer about leave", body: "Give written notice at least 30 days before leave starts when you can. Keep a copy.", edited: false, source: src("US Department of Labor: FMLA", "https://www.dol.gov/agencies/whd/fmla") },
];

const offers: PartnerOffer[] = [
  { id: uid(900), partnerName: "Mossy Diapers", title: "First box of diapers, half price", detail: "Soft, fragrance-free diapers delivered before the due date.", url: "https://example.com/mossy-diapers", stages: ["pregnancy", "postpartum"], audience: ["mother", "partner"], active: true, clicks: 14 },
  { id: uid(901), partnerName: "Little Lantern", title: "Night light and white noise, one device", detail: "A dim amber light that is easy on tired eyes at 3 am.", url: "https://example.com/little-lantern", stages: ["pregnancy", "postpartum", "infant"], audience: ["mother", "partner"], active: true, clicks: 9 },
  { id: uid(902), partnerName: "Harbor Birth Classes", title: "Online childbirth class, first session free", detail: "Evening sessions for two. Recordings stay for 30 days.", url: "https://example.com/harbor-classes", stages: ["pregnancy"], audience: ["partner"], active: true, clicks: 6 },
  { id: uid(903), partnerName: "Fern & Co", title: "Meal kits for the first month home", detail: "Ten simple dinners that reheat in minutes.", url: "https://example.com/fern-meals", stages: ["postpartum"], audience: ["mother", "partner"], active: false, clicks: 2 },
];

const stageOf = (s: string | undefined): Stage => (s as Stage) ?? "pregnancy";

// A tiny deterministic wobble so charts have a shape without a random source.
const wave = (i: number, base: number, amp: number) => Math.max(0, Math.round(base + amp * Math.sin(i * 1.7) + amp * 0.5 * Math.cos(i * 0.6)));

const metrics: [AnalyticsMetric, number, number][] = [
  ["demo_started", 6, 4],
  ["custom_family_started", 2, 1.5],
  ["task_created", 11, 6],
  ["task_done", 8, 5],
  ["handoff_created", 4, 2],
  ["care_log_entry_created", 9, 5],
  ["simulator_round_played", 5, 3],
  ["booking_requested", 2, 1.5],
  ["invitation_accepted", 1.5, 1],
  ["checkout_started", 1.5, 1],
  ["checkout_paid", 0.8, 0.8],
  ["partner_offer_clicked", 2.5, 2],
];

export const adminMocks = {
  ...mock("/admin/content-items", "get", (ctx) => ({ items: content.filter((c) => c.kind === ctx.query.kind) })),
  ...mock("/admin/content-items/{kind}/{itemId}", "patch", (ctx) => {
    const item = content.find((c) => c.kind === ctx.path.kind && c.id === ctx.path.itemId) ?? content[0];
    return { ...item, ...ctx.body, edited: true, updatedAt: new Date().toISOString() };
  }),
  ...mock("/admin/content-items/{kind}/{itemId}/reset", "post", (ctx) => {
    const item = content.find((c) => c.kind === ctx.path.kind && c.id === ctx.path.itemId) ?? content[0];
    return { ...item, edited: false, updatedAt: undefined };
  }, 200),
  ...mock("/admin/partner-offers", "get", () => ({ items: offers })),
  ...mock("/admin/partner-offers", "post", (ctx) => ({ ...ctx.body, id: uid(910 + Math.floor(Math.random() * 80)), clicks: 0 })),
  ...mock("/admin/partner-offers/{offerId}", "patch", (ctx) => {
    const offer = offers.find((o) => o.id === ctx.path.offerId) ?? offers[0];
    return { ...offer, ...ctx.body };
  }),
  ...mock("/members/{memberId}/partner-offers", "get", async (ctx) => {
    const family = await ctx.family();
    // None in pregnancy loss support.
    if (inLossSupport(family)) return { items: [] };
    const stage = stageOf(family.stage);
    const role = family.parents.find((p) => p.id === ctx.path.memberId)?.role;
    return { items: offers.filter((o) => o.active && o.stages.includes(stage) && (!role || o.audience.includes(role))).slice(0, 3).map(({ clicks, ...o }) => (void clicks, o)) };
  }),
  ...mock("/members/{memberId}/partner-offers/{offerId}/clicks", "post", () => undefined as never, 204),
  ...mock("/admin/analytics", "get", (ctx) => {
    const days = Math.min(90, Math.max(1, Number(ctx.query.days) || 14));
    const dates = Array.from({ length: days }, (_, i) => isoDate(i - days + 1));
    const series = metrics.map(([metric, base, amp], m) => {
      const list = dates.map((date, i) => ({ date, count: wave(i + m * 3, base, amp) }));
      return { metric, total: list.reduce((n, d) => n + d.count, 0), days: list };
    });
    const started = series[0].total;
    return {
      from: dates[0],
      to: dates[days - 1],
      generatedAt: new Date().toISOString(),
      templates: [
        { template: "pregnancy", families: Math.round(started * 0.4) },
        { template: "newborn", families: Math.round(started * 0.25) },
        { template: "planning", families: Math.round(started * 0.2) },
        { template: "preschool", families: Math.round(started * 0.1) },
        { template: "custom", families: Math.round(started * 0.05) },
      ],
      series,
    };
  }),
};
