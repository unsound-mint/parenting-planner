import type { Family, LeaveDeadline, LeavePlan, LeavePlanInput, LeaveProgram, LeaveSegment, ParentLeave } from "@/lib/api/types";
import { mock } from "../registry";
import { couple, taskId } from "../timeline";
import { CHECKED } from "./dates";
import { paperworkN } from "./tasks";

// Preview data for the leave planner. Emily (mother) has filled in the wizard,
// Jake (partner) has not, so his lane shows the wizard. The segment maths is a
// small stand-in for the Go catalog: California programs plus FMLA, nothing else.

const DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const today = () => new Date().toISOString().slice(0, 10);

const src = (title: string, url: string) => ({ title, url, checkedAt: CHECKED });
const DOL = src("U.S. Department of Labor: Family and Medical Leave Act", "https://www.dol.gov/agencies/whd/fmla");
const EDD = src("California EDD: Paid Family Leave", "https://edd.ca.gov/en/disability/paid-family-leave/");
const SDI = src("California EDD: State Disability Insurance", "https://edd.ca.gov/en/disability/");
const CRD = src("California Civil Rights Department: CFRA", "https://calcivilrights.ca.gov/cfra/");

const store = new Map<string, Map<string, LeavePlanInput>>();

function inputs(family: Family) {
  let m = store.get(family.id);
  if (!m) {
    const { mother } = couple(family);
    m = new Map([[mother.id, { state: "CA", employerEmployees: 450, monthsEmployed: 34, hoursLast12Months: 1900, weeksWanted: 12 }]]);
    store.set(family.id, m);
  }
  return m;
}

function programsFor(input: LeavePlanInput, role: "mother" | "partner"): LeaveProgram[] {
  const fmlaOk = input.employerEmployees >= 50 && input.monthsEmployed >= 12 && input.hoursLast12Months >= 1250;
  const fmla: LeaveProgram = {
    id: "fmla",
    name: "FMLA",
    kind: "job_protection",
    eligibility: fmlaOk ? "eligible" : "not_eligible",
    weeks: fmlaOk ? 12 : undefined,
    reason: fmlaOk ? "50 or more employees, 12 months and 1,250 hours." : "Needs 50 employees nearby, 12 months and 1,250 hours.",
    source: DOL,
  };
  if (input.state !== "CA") return [fmla];
  const out: LeaveProgram[] = [fmla];
  if (role === "mother") {
    out.push({ id: "ca_sdi", name: "California SDI", kind: "paid_leave", eligibility: "eligible", weeks: 6, pay: "About 60 to 70 percent of wages, up to a weekly cap.", reason: "Recovery from birth, usually 6 weeks.", source: SDI });
  }
  out.push(
    { id: "ca_pfl", name: "California PFL", kind: "paid_leave", eligibility: "eligible", weeks: 8, pay: "About 60 to 70 percent of wages, up to a weekly cap.", reason: "Bonding with a new child, 8 weeks.", source: EDD },
    { id: "cfra", name: "CFRA", kind: "job_protection", eligibility: input.employerEmployees >= 5 && input.monthsEmployed >= 12 ? "eligible" : "unknown", weeks: 12, reason: "5 or more employees and 12 months.", source: CRD },
  );
  return out;
}

function segmentsFor(start: string, weeks: number, role: "mother" | "partner", programs: LeaveProgram[]): LeaveSegment[] {
  const ok = (id: string) => programs.find((p) => p.id === id)?.eligibility === "eligible";
  const paidPhases = role === "mother" && ok("ca_sdi") ? [{ id: "ca_sdi", from: 0, to: 6 }, { id: "ca_pfl", from: 6, to: 14 }] : [{ id: "ca_pfl", from: 0, to: 8 }];
  const protectedTo = ok("fmla") ? 12 : 0;
  const cuts = [...new Set([0, weeks, protectedTo, ...paidPhases.flatMap((p) => [p.from, p.to])].filter((w) => w >= 0 && w <= weeks))].sort((a, b) => a - b);
  const out: LeaveSegment[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [from, to] = [cuts[i], cuts[i + 1]];
    const paid = ok("ca_pfl") ? paidPhases.find((p) => from >= p.from && to <= p.to) : undefined;
    const prot = to <= protectedTo;
    out.push({
      startsOn: addDays(start, from * 7),
      endsOn: addDays(start, to * 7),
      programIds: [...(paid ? [paid.id] : []), ...(prot ? ["fmla"] : [])],
      paid: !!paid,
      jobProtected: prot,
    });
  }
  return out;
}

function parentLeave(family: Family, memberId: string, input: LeavePlanInput | undefined): ParentLeave {
  const { mother } = couple(family);
  const role = memberId === mother.id ? "mother" : "partner";
  if (!input) return { memberId, role, programs: [], segments: [], deadlines: [] };
  const due = family.dueDate ?? addDays(today(), 105);
  const start = input.startsOn ?? due;
  const weeks = input.weeksWanted ?? (role === "mother" ? 12 : 8);
  const programs = programsFor(input, role);
  const deadlines: LeaveDeadline[] = [];
  if (programs.find((p) => p.id === "fmla")?.eligibility === "eligible") {
    deadlines.push({
      title: "Give your employer written notice",
      // The paperwork task sits 109 days before the due date; it moves with the leave start.
      dueOn: addDays(due, -109 + daysBetween(due, start)),
      programId: "fmla",
      ...(role === "mother" ? { taskId: taskId(family.id, paperworkN.leaveNotice) } : {}),
      source: DOL,
    });
  }
  if (input.state === "CA") deadlines.push({ title: "File your California PFL claim", dueOn: addDays(start, -7), programId: "ca_pfl", source: EDD });
  deadlines.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return { memberId, role, input, programs, segments: segmentsFor(start, weeks, role, programs), deadlines };
}

async function planFor(family: () => Promise<Family>, actingId: string): Promise<LeavePlan> {
  const f = await family();
  const { mother, partner } = couple(f);
  const m = inputs(f);
  const order = actingId === partner.id ? [partner, mother] : [mother, partner];
  return { parents: order.map((p) => parentLeave(f, p.id, m.get(p.id))) };
}

export const leaveMocks = {
  ...mock("/members/{memberId}/leave-plan", "get", (ctx) => planFor(ctx.family, ctx.path.memberId)),
  ...mock("/members/{memberId}/leave-plan", "put", async (ctx) => {
    inputs(await ctx.family()).set(ctx.path.memberId, ctx.body);
    return planFor(ctx.family, ctx.path.memberId);
  }),
};
