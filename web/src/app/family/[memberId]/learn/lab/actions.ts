"use server";

import { serverApi } from "@/lib/api/server";
import type { CoupleTalk, LabCard } from "@/lib/api/types";

// The lab's writes go through the server like Learn's: the API checks the
// session and the member on every call.

type Result<T> = { ok: true; data: T } | { ok: false; status: number };

export async function saveLabAnswer(memberId: string, cardId: string, choiceId: "a" | "b" | "c" | "d" | "other", otherText?: string): Promise<Result<LabCard>> {
  const api = await serverApi();
  const { data, response } = await api.POST("/members/{memberId}/lab-answers", {
    params: { path: { memberId } },
    body: { cardId, choiceId, ...(choiceId === "other" && otherText ? { otherText } : {}) },
  });
  return data ? { ok: true, data } : { ok: false, status: response.status };
}

export async function saveLabTalk(memberId: string, promptId: string): Promise<Result<CoupleTalk>> {
  const api = await serverApi();
  const { data, response } = await api.POST("/members/{memberId}/couple-talks", { params: { path: { memberId } }, body: { promptId } });
  return data ? { ok: true, data } : { ok: false, status: response.status };
}
