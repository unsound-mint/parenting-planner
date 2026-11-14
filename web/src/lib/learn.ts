import type { Guide, GuideAction, PlanItem, Weekday } from "@/lib/api/types";
import { guideRepeatsPlan } from "@/lib/week";

// Learn: every lesson ends in exactly one action. Guide.action says which; until
// the API fills it, the table below chooses by guide id. A guide with neither
// gets the default: put a question about it on the next visit. Delete the table
// once the catalog (api/internal/content) sets action on every guide.

export type LessonAction =
  | { kind: "task"; title: string; label?: string }
  | { kind: "question"; text: string; label?: string }
  | { kind: "practice"; label?: string }
  | { kind: "shift"; title: string; days: Weekday[]; startTime: string; endTime: string; label?: string };

const everyDay: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const task = (title: string): LessonAction => ({ kind: "task", title });
const ask = (text: string): LessonAction => ({ kind: "question", text });
const practice: LessonAction = { kind: "practice" };

const actions: Record<string, LessonAction> = {
  "planning-folic-acid": ask("Should I start folic acid before we try, and which kind fits me?"),
  "planning-preconception-visit": task("Book a preconception visit"),
  "trying-fertility-evaluation": ask("When should we ask for a fertility evaluation, given our ages?"),
  "preg-first-visit": task("Book the first prenatal visit"),
  "preg-screening-choices": ask("Which first-trimester screening do you recommend for us?"),
  "preg-warning-signs": practice,
  "preg-glucose-screen": task("Book the glucose test"),
  "preg-tdap": ask("When in weeks 27 to 36 should I get the Tdap vaccine?"),
  "preg-partner-vaccines": task("Check my own vaccines"),
  "preg-rsv": ask("Is the RSV vaccine right for me this season?"),
  "preg-gbs": ask("When is the group B strep swab, and what happens if it is positive?"),
  "preg-labor-signs": practice,
  "postpartum-warning-signs": ask("Which signs in me or the baby mean we should call you the same day?"),
  "postpartum-baby-insurance": task("Enroll the baby in health insurance"),
  "postpartum-leave": task("Request parental leave"),
  "postpartum-night-shifts": {
    kind: "shift",
    title: "Night shift with the baby",
    days: everyDay,
    startTime: "22:00",
    endTime: "02:00",
    label: "Take 22:00 to 02:00",
  },
  "postpartum-partner-mood": task("Do a mood and sleep check-in for myself"),
  "postpartum-couple-checkin": task("Hold a 10 minute check-in this week"),
  "postpartum-newborn-visit": ask("What should we bring and ask at the first newborn visit?"),
  "postpartum-pumping-at-work": task("Ask work for pumping breaks and a private space"),
  "infant-milestones-9m": ask("Which developmental screening tool will you use at 9 months?"),
  "infant-dental-home": task("Find a dentist for the baby"),
  "toddler-18m-visit": ask("What does the developmental and autism screening at 18 months involve?"),
  "toddler-car-seat": task("Check the car seat is rear-facing and fits"),
  "toddler-water-safety": task("Sign up for water safety lessons"),
  "toddler-screen-time": task("Agree on screen time with my partner"),
  "preschool-vision": task("Book a vision screen"),
  "preschool-boosters": task("Book the 4 to 6 year boosters"),
  "preschool-kindergarten": task("Check the kindergarten cutoff date"),
  "preschool-car-seat": task("Check the car seat fit"),
  "school-yearly-visit": task("Book the yearly well-child visit"),
  "school-booster-seat": task("Check the booster seat fit"),
};

/** The contract's action as a LessonAction; undefined when its payload is missing. */
function fromContract({ kind, label, title, question, shift }: GuideAction): LessonAction | undefined {
  switch (kind) {
    case "add_task":
      return title ? { kind: "task", title, label } : undefined;
    case "ask_at_visit":
      return question ? { kind: "question", text: question, label } : undefined;
    case "commit_shift":
      return shift ? { kind: "shift", ...shift, label } : undefined;
    case "practice":
      return { kind: "practice", label };
  }
}

/** The one action of a lesson. */
export function lessonAction(guide: Guide): LessonAction {
  return (guide.action && fromContract(guide.action)) || actions[guide.id] || ask(`Ask about: ${guide.title.toLowerCase()}`);
}

/**
 * Lessons for this person: the API already filters by stage, week and role
 * (listGuides). Anything This week shows as a plan item is left out; the item
 * says it already. Birth prep and loss support have their own places.
 */
export function lessonsFor(guides: Guide[], plan: PlanItem[]): Guide[] {
  return guides.filter((g) => g.kind === "article" && !g.locked && !guideRepeatsPlan(g, plan));
}
