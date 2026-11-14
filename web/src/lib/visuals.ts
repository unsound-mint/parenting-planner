import {
  Activity,
  Baby,
  Armchair,
  BedDouble,
  Bell,
  CalendarDays,
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
  Music,
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
  SquareCheck,
  Stethoscope,
  Syringe,
  TestTube,
  Thermometer,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";
import type { AllergyCertainty, CalendarEventKind, CareRole, HospitalBag, PlanCategory, PlanItemStatus, ProviderType, SimulatorSkill, Stage, Tier, Visibility } from "@/lib/api/types";

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

/** The written weekly note from the AI plan (components/week/plan-with-note.tsx). */
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

/** Calendar event kinds (components/schedule/week-view.tsx). A shift is a baby; a task a tick. */
export const calendarKindIcon: Record<CalendarEventKind, LucideIcon> = {
  appointment: Stethoscope,
  class: GraduationCap,
  reminder: Bell,
  other: CalendarDays,
  shift: Baby,
  task: SquareCheck,
  psychologist_session: Brain,
};

export const calendarKindLabel: Record<CalendarEventKind, string> = {
  appointment: "Appointment",
  class: "Class",
  reminder: "Reminder",
  other: "Event",
  shift: "Shift",
  task: "Task due",
  psychologist_session: "Session",
};

/** Simulator skills (components/simulator). */
export const skillIcon: Record<SimulatorSkill, LucideIcon> = {
  feeding: Milk,
  soothing: Music,
  safe_sleep: BedDouble,
  diapering: Baby,
  warning_signs: Thermometer,
  teamwork: Users,
};

export const skillLabel: Record<SimulatorSkill, string> = {
  feeding: "Feeding",
  soothing: "Soothing",
  safe_sleep: "Safe sleep",
  diapering: "Diapering",
  warning_signs: "Warning signs",
  teamwork: "Teamwork",
};

/** Event card by owner: a left edge and a soft wash in the owner's accent (never colour alone: the name is written too). */
export const roleTint: Record<Role, string> = {
  mother: "border-l-mom bg-mom/10",
  partner: "border-l-partner bg-partner/10",
  grandparent: "border-l-grandparent bg-grandparent/10",
  nanny: "border-l-nanny bg-nanny/10",
};

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
