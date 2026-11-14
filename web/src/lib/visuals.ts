import {
  Activity,
  Baby,
  Armchair,
  Backpack,
  Blocks,
  BookOpen,
  Brain,
  CalendarClock,
  CircleHelp,
  ContactRound,
  HandHeart,
  ConciergeBell,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Droplet,
  Droplets,
  Handshake,
  IdCard,
  Moon,
  CalendarDays,
  Flower2,
  Footprints,
  GraduationCap,
  Heart,
  HeartHandshake,
  HeartPulse,
  ListChecks,
  Leaf,
  Lock,
  MessagesSquare,
  MessageCircleHeart,
  Milk,
  NotebookPen,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  Smile,
  MoonStar,
  Puzzle,
  PenLine,
  Sparkles,
  Sprout,
  Stethoscope,
  Syringe,
  TestTube,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";
import type { AllergyCertainty, CareLogKind, CaregiverPermission, DiaperContent, FeedMethod, CareRole, HospitalBag, PlanCategory, PlanItemStatus, ProviderType, Stage, Tier, Visibility } from "@/lib/api/types";

// One icon per concept, used the same way on every screen
// (docs/design.md, "Hierarchy and visuals", rule 6).

export const categoryIcon: Record<PlanCategory, LucideIcon> = {
  screening: TestTube,
  vaccine: Syringe,
  visit: Stethoscope,
  mental_health: Brain,
  logistics: ClipboardCheck,
  couple: HeartHandshake,
  learning: BookOpen,
};

export const categoryLabel: Record<PlanCategory, string> = {
  screening: "Screening",
  vaccine: "Vaccine",
  visit: "Visit",
  mental_health: "Mental health",
  logistics: "Logistics",
  couple: "Together",
  learning: "Learning",
};

/** Journey node key (components/journey/stages.ts) to icon. */
export const stageIcon: Record<string, LucideIcon> = {
  planning: Sprout,
  pregnancy: HeartPulse,
  birth: Sparkles,
  newborn: Baby,
  "first-year": Milk,
  toddler: Footprints,
  preschool: Blocks,
  "school-age": Backpack,
};

/** The family's stage (API value) to icon; same pictures as the journey nodes. */
export const stageValueIcon: Record<Stage, LucideIcon> = {
  planning: Sprout,
  trying: Sprout,
  pregnancy: HeartPulse,
  postpartum: Baby,
  infant: Milk,
  toddler: Footprints,
  preschool: Blocks,
  school_age: Backpack,
};

export const visibilityIcon: Record<Visibility, LucideIcon> = {
  private: Lock,
  partner: HeartHandshake,
  care_team: Stethoscope,
  family: Users,
};

export const tierIcon: Record<Tier, LucideIcon> = {
  free: Leaf,
  plus: Sparkles,
  concierge: ConciergeBell,
};

/** Soft tinted circle behind an item icon, by plan status. */
export const statusTint: Record<PlanItemStatus, string> = {
  overdue: "bg-status-late-soft text-status-late",
  due: "bg-status-due-soft text-status-due",
  upcoming: "bg-status-up-soft text-status-up",
};

/** Who is acting: icon, short label and the accent for the avatar (tokens in globals.css). */
export const roleIcon: Record<Role, LucideIcon> = {
  mother: Heart,
  partner: HeartHandshake,
  grandparent: Armchair,
  nanny: HandHeart,
};

export const roleLabel: Record<Role, string> = {
  mother: "Mom",
  partner: "Partner",
  grandparent: "Grandparent",
  nanny: "Nanny",
};

export const roleAccent: Record<Role, { bg: string; text: string }> = {
  mother: { bg: "bg-mom", text: "text-mom" },
  partner: { bg: "bg-partner", text: "text-partner" },
  grandparent: { bg: "bg-grandparent", text: "text-grandparent" },
  nanny: { bg: "bg-nanny", text: "text-nanny" },
};

/** Psychologist flow concepts (docs/product.md, must-have 7). */
export const careIcon = {
  diary: NotebookPen,
  agenda: ListChecks,
  session: CalendarClock,
  note: PenLine,
  provider: UserRound,
} satisfies Record<string, LucideIcon>;
export const visibilityLabel: Record<Visibility, string> = {
  private: "Only you",
  partner: "Shared with your partner",
  care_team: "Your care team",
  family: "Whole family",
};

/** Health passport sections. */
export const passportIcon = {
  labs: TestTube,
  vaccines: Syringe,
  allergies: ShieldAlert,
  growth: Ruler,
  careTeam: ContactRound,
} satisfies Record<string, LucideIcon>;

/** Confirmed is a solid shield, suspected a dashed question mark: two shapes, not two colours. */
export const allergyIcon: Record<AllergyCertainty, LucideIcon> = {
  confirmed: ShieldCheck,
  suspected: CircleHelp,
};

export const careRoleIcon: Record<CareRole, LucideIcon> = {
  obstetrician: HeartPulse,
  pediatrician: Baby,
  primary_care: Stethoscope,
  psychologist: Brain,
  lactation_consultant: Milk,
  midwife: HandHeart,
  dentist: Smile,
};

export const careRoleLabel: Record<CareRole, string> = {
  obstetrician: "Obstetrician",
  pediatrician: "Pediatrician",
  primary_care: "Primary care",
  psychologist: "Psychologist",
  lactation_consultant: "Lactation consultant",
  midwife: "Midwife",
  dentist: "Dentist",
};

/** Directory provider types, in the order the filter shows them. */
export const providerTypeIcon: Record<ProviderType, LucideIcon> = {
  perinatal_therapist: Flower2,
  psychologist: MessagesSquare,
  doula: HandHeart,
  lactation_consultant: Droplet,
  sleep_consultant: MoonStar,
  child_therapist: Puzzle,
  tutor: GraduationCap,
};

export const providerTypeLabel: Record<ProviderType, { one: string; many: string }> = {
  perinatal_therapist: { one: "Perinatal therapist", many: "Perinatal therapists" },
  psychologist: { one: "Psychologist", many: "Psychologists" },
  doula: { one: "Doula", many: "Doulas" },
  lactation_consultant: { one: "Lactation consultant", many: "Lactation consultants" },
  sleep_consultant: { one: "Sleep consultant", many: "Sleep consultants" },
  child_therapist: { one: "Child therapist", many: "Child therapists" },
  tutor: { one: "Tutor", many: "Tutors" },
};

export const providerTypes = Object.keys(providerTypeIcon) as ProviderType[];

/** The written weekly note from the AI plan (components/week/ai-plan.tsx). */
export const weeklyNoteIcon: LucideIcon = PenLine;

/** A detected pattern in the parent's own check-ins. */
export const patternIcon = Activity;

/** "Talk to someone": the link from a pattern to the provider directory. */
export const talkIcon = MessageCircleHeart;
/** Solid bar colour by plan status: Journey lanes and the focus card's countdown. */
export const statusBar: Record<PlanItemStatus, string> = {
  overdue: "bg-status-late",
  due: "bg-status-due",
  upcoming: "bg-status-up",
};

/** Care log kinds (feed, sleep, diaper): the same icon and tint on the tiles, the day timeline and the handoff. */
export const careLogIcon: Record<CareLogKind, LucideIcon> = {
  feed: Milk,
  sleep: Moon,
  diaper: Droplets,
};

export const careLogLabel: Record<CareLogKind, string> = {
  feed: "Feed",
  sleep: "Sleep",
  diaper: "Diaper",
};

/** Tint classes per kind; status tokens only, no new colours. */
export const careLogTint: Record<CareLogKind, { soft: string; solid: string }> = {
  feed: { soft: "bg-status-up-soft text-status-up", solid: "bg-status-up" },
  sleep: { soft: "bg-secondary text-secondary-foreground", solid: "bg-primary" },
  diaper: { soft: "bg-status-due-soft text-status-due", solid: "bg-status-due" },
};

export const feedMethodLabel: Record<FeedMethod, string> = {
  breast_left: "Left breast",
  breast_right: "Right breast",
  bottle_breast_milk: "Bottle, breast milk",
  bottle_formula: "Bottle, formula",
};

export const diaperLabel: Record<DiaperContent, string> = { wet: "Wet", dirty: "Dirty", both: "Wet and dirty" };

/** One icon and a plain label per permission: the invite toggles and the preview use the same pair. */
export const permissionIcon: Record<CaregiverPermission, LucideIcon> = {
  care_log: Milk,
  baby_passport: IdCard,
  schedule: CalendarDays,
  family_plan: ListChecks,
  pregnancy_updates: HeartPulse,
};

export const permissionLabel: Record<CaregiverPermission, { name: string; hint: string }> = {
  care_log: { name: "Feeding, sleep and diapers", hint: "Logs them and takes over at a handoff" },
  baby_passport: { name: "Baby card", hint: "Allergies, pediatrician and emergency contacts" },
  schedule: { name: "Their shifts and visits", hint: "Only the ones they are part of" },
  family_plan: { name: "Shared to-do list", hint: "Tasks offered to them" },
  pregnancy_updates: { name: "Pregnancy updates", hint: "The weekly card and guides" },
};

export const handoffIcon = Handshake;

/** The Plan screen: its nav entry, the paperwork timeline and the three hospital bags. */
export const planIcon: LucideIcon = ClipboardList;
export const paperworkIcon: LucideIcon = FileText;
export const bagIcon: Record<HospitalBag, LucideIcon> = {
  mother: Heart,
  partner: HeartHandshake,
  baby: Baby,
};
export const bagLabel: Record<HospitalBag, string> = {
  mother: "Mom's bag",
  partner: "Partner's bag",
  baby: "Baby's bag",
};
