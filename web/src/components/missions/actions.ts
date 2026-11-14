"use server";

import { serverApi } from "@/lib/api/server";
import type { Mission } from "@/lib/api/types";

// Writes go through the server so the session cookie is attached; the API
// checks the session and the member on every call.

type Result<T> = { ok: true; data: T } | { ok: false; reason?: "taken" | "wrong_stage" | "not_taken" | "done" };

const reasonOf = (error: unknown): "taken" | "wrong_stage" | "not_taken" | "done" | undefined => {
  const code = (error as { code?: string } | undefined)?.code;
  return code === "mission_taken" ? "taken" : code === "wrong_stage" ? "wrong_stage" : code === "not_taken" ? "not_taken" : code === "mission_done" ? "done" : undefined;
};

export async function takeMission(memberId: string, key: string): Promise<Result<Mission>> {
  const api = await serverApi();
  const { data, error } = await api.POST("/members/{memberId}/missions/{missionKey}/take", { params: { path: { memberId, missionKey: key } } });
  return data ? { ok: true, data } : { ok: false, reason: reasonOf(error) };
}

export async function finishMission(memberId: string, key: string, note?: string): Promise<Result<Mission>> {
  const api = await serverApi();
  const { data, error } = await api.POST("/members/{memberId}/missions/{missionKey}/done", {
    params: { path: { memberId, missionKey: key } },
    body: note?.trim() ? { note: note.trim().slice(0, 140) } : {},
  });
  return data ? { ok: true, data } : { ok: false, reason: reasonOf(error) };
}

export async function swapMission(memberId: string, key: string): Promise<Result<null>> {
  const api = await serverApi();
  const { response, error } = await api.POST("/members/{memberId}/missions/{missionKey}/swap", { params: { path: { memberId, missionKey: key } } });
  return response.ok ? { ok: true, data: null } : { ok: false, reason: reasonOf(error) };
}

export async function markStickerSeen(memberId: string, key: string): Promise<void> {
  const api = await serverApi();
  await api.POST("/members/{memberId}/stickers/{stickerKey}/seen", { params: { path: { memberId, stickerKey: key } } });
}
