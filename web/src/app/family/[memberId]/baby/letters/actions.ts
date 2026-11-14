"use server";

import { serverApi } from "@/lib/api/server";
import type { Letter, LetterInput } from "@/lib/api/types";

type Result<T> = { ok: true; data: T } | { ok: false; status: number };

export async function createLetter(memberId: string, body: LetterInput): Promise<Result<Letter>> {
  const api = await serverApi();
  const { data, response } = await api.POST("/members/{memberId}/letters", { params: { path: { memberId } }, body });
  return data ? { ok: true, data } : { ok: false, status: response.status };
}

export async function updateLetter(memberId: string, letterId: string, body: LetterInput): Promise<Result<Letter>> {
  const api = await serverApi();
  const { data, response } = await api.PUT("/members/{memberId}/letters/{letterId}", { params: { path: { memberId, letterId } }, body });
  return data ? { ok: true, data } : { ok: false, status: response.status };
}

export async function deleteLetter(memberId: string, letterId: string): Promise<Result<null>> {
  const api = await serverApi();
  const { response } = await api.DELETE("/members/{memberId}/letters/{letterId}", { params: { path: { memberId, letterId } } });
  return response.ok ? { ok: true, data: null } : { ok: false, status: response.status };
}
