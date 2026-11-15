"use server";

import { serverApi } from "@/lib/api/server";
import type { LibraryTopic } from "@/lib/api/types";

// The Questions library's calls. Ask privately reuses the existing private
// stores: an appointment question (visibility private) or, for feelings, a
// private journal line whose short topic goes to the psychologist agenda.
// Nothing here is answered by AI.

export async function loadTopic(memberId: string, topicId: string): Promise<LibraryTopic | null> {
  const api = await serverApi();
  const path = { params: { path: { memberId, topicId } } };
  const [{ data }] = await Promise.all([
    api.GET("/members/{memberId}/library-topics/{topicId}", path),
    // Opening a topic is reading it: the library shows it as Read from now on.
    api.PUT("/members/{memberId}/library-reads/{topicId}", { ...path, body: { read: true } }),
  ]);
  return data ?? null;
}

/** Save a topic for later, or unsave it. Returns the saved state the API holds, or null on failure. */
export async function saveTopic(memberId: string, topicId: string, saved: boolean): Promise<boolean | null> {
  const api = await serverApi();
  const { data } = await api.PUT("/members/{memberId}/library-reads/{topicId}", { params: { path: { memberId, topicId } }, body: { saved } });
  return data ? !!data.savedAt : null;
}

export type AskTo = "appointment" | "psychologist";
export type AskResult = { ok: true; to: AskTo; appointmentId?: string; when?: string; with?: string } | { ok: false; reason: "no_appointment" | "failed" };

export async function askPrivately(memberId: string, text: string, to: AskTo): Promise<AskResult> {
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const body = text.trim().slice(0, 300);
  if (!body) return { ok: false, reason: "failed" };
  if (to === "psychologist") {
    const topic = body.length > 120 ? body.slice(0, 117).trimEnd() + "..." : body;
    const { data } = await api.POST("/members/{memberId}/diary-entries", { ...path, body: { body, visibility: "private", agendaTopic: topic } });
    return data ? { ok: true, to } : { ok: false, reason: "failed" };
  }
  const { data, response } = await api.POST("/members/{memberId}/appointment-questions", { ...path, body: { text: body, visibility: "private" } });
  if (response.status === 409) return { ok: false, reason: "no_appointment" };
  if (!data) return { ok: false, reason: "failed" };
  const list = await api.GET("/members/{memberId}/appointment-questions", path);
  const appt = list.data?.appointments.find((a) => a.id === data.askedForAppointmentId);
  return { ok: true, to, appointmentId: data.askedForAppointmentId, when: appt?.startsAt, with: appt?.title };
}
