import type { AppointmentNote, BirthPlan, BringItem } from "@/lib/api/types";
import { inLossSupport } from "@/lib/loss";
import { mock } from "../registry";
import { birthHospital, calendarEvent, couple, events, isNewborn, newbornEvents, obstetricianOf, taskId } from "../timeline";
import { demoQuestions, newbornQuestions } from "./appointment-questions";
import { paperworkN } from "./tasks";

// Preview data for "Going to the hospital" and the appointment prep view. The
// documents link to paperwork tasks of the tasks fixture, so ticking one off on
// the Plan screen shows here too (the mock reads the same in-memory tasks).

const MAPS = "https://www.google.com/maps/dir/?api=1&destination=";
const mapsUrl = (address: string) => MAPS + encodeURIComponent(address);

/** Fixed buffer the real endpoint adds to the drive (see AppointmentTravel.minutes). */
const BUFFER_MINUTES = 10;
const CLINIC_DRIVE_MINUTES = 18;
// Both clinics are known by name and city only in the seeds, so the map points at the city.
const CLINIC_ADDRESS = "Riverbend Women's Health, Austin, TX";
const NEWBORN_ADDRESS = "Harborview Pediatrics, Boston, MA";

// The after-visit note, kept per parent and visit. Private to its author: the key
// includes the acting member, like the real table's (author, appointment) key.
const notes = new Map<string, AppointmentNote>();

export const birthPlanMocks = {
  ...mock("/members/{memberId}/birth-plan", "get", async (ctx): Promise<BirthPlan> => {
    const family = await ctx.family();
    // Nothing to prepare once the baby is born: the 501 stands and the screen is not offered.
    if (isNewborn(family)) return undefined as never;
    if (inLossSupport(family)) throw new Error("no birth plan during pregnancy loss support");
    const { mother, partner } = couple(family);
    const other = ctx.path.memberId === mother.id ? partner : mother;
    const documents: BringItem[] = [
      { title: "Photo ID and insurance card", detail: "One set each, in the outside pocket of the bag.", ready: true },
      { title: "Pre-registration at the hospital", detail: "Skips the front desk forms when you arrive.", ready: false, taskId: taskId(family.id, paperworkN.preRegister) },
      { title: "Copy of your birth preferences", detail: "Print two: one for the nurse, one for you.", ready: false },
    ];
    return {
      hospital: { name: birthHospital.name, address: birthHospital.address, phone: birthHospital.phone, mapsUrl: mapsUrl(birthHospital.address), travelMinutes: birthHospital.travelMinutes },
      contacts: [
        { label: "Labour and delivery desk", name: birthHospital.name, phone: birthHospital.deskPhone },
        { label: "Your OB", name: obstetricianOf(family).name, phone: obstetricianOf(family).phone },
        { label: "Your partner", name: other.displayName, phone: "555-0107", memberId: other.id },
      ],
      documents,
      preferencesNote: "Walking in early labour, dim lights, skin to skin straight after birth. To talk through with Dr. Shah.",
    };
  }),
  ...mock("/members/{memberId}/labour-alerts", "post", () => undefined as never, 204),
  ...mock("/members/{memberId}/appointments/{appointmentId}/note", "put", (ctx): AppointmentNote => {
    const note = { text: ctx.body.text.trim(), updatedAt: new Date().toISOString() };
    const key = `${ctx.path.memberId}:${ctx.path.appointmentId}`;
    if (note.text) notes.set(key, note);
    else notes.delete(key);
    return note;
  }),
  ...mock("/members/{memberId}/appointments/{appointmentId}/prep", "get", async (ctx) => {
    const family = await ctx.family();
    const c = couple(family);
    const newborn = isNewborn(family);
    const spec = Object.values<{ id: string; kind: string }>(newborn ? newbornEvents : events).find((e) => e.id === ctx.path.appointmentId && e.kind === "appointment") as (typeof events)[keyof typeof events] | undefined;
    if (!spec || inLossSupport(family)) throw new Error(`mock appointment ${ctx.path.appointmentId} not found`);
    const appointment = calendarEvent(spec, c);
    const address = newborn ? NEWBORN_ADDRESS : CLINIC_ADDRESS;
    const minutes = CLINIC_DRIVE_MINUTES + BUFFER_MINUTES;
    const documents: BringItem[] = [
      { title: "Insurance card and photo ID", ready: false },
      ...(spec.id === newbornEvents.weightCheck.id ? [{ title: "Leo's feeding and diaper log", detail: "The Baby screen shows the last days.", ready: false }] : []),
      ...(spec.id === events.glucoseTest.id ? [{ title: "The lab order from Dr. Shah", detail: "Ask at the desk if it is not in your portal.", ready: false }] : []),
      ...(spec.id === events.anatomyScan.id ? [{ title: "Your last scan report", ready: false }] : []),
      ...(spec.id === events.prenatalVisit.id ? [{ title: "Your blood pressure and weight notes", detail: "From this week, if you took them.", ready: false }] : []),
    ];
    return {
      appointment: { ...appointment, location: `${appointment.location}, ${address}` },
      travel: { minutes, leaveBy: new Date(Date.parse(appointment.startsAt) - minutes * 60_000).toISOString(), mapsUrl: mapsUrl(address) },
      documents,
      questions: (newborn ? newbornQuestions(ctx.path.memberId) : demoQuestions(ctx.path.memberId))
        .filter((q) => q.appointmentId === spec.id)
        .sort((a, b) => Number(a.answered) - Number(b.answered) || a.createdAt.localeCompare(b.createdAt)),
      note: notes.get(`${ctx.path.memberId}:${ctx.path.appointmentId}`),
    };
  }),
};
