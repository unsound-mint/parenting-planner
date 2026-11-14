"use server";

import { serverApi } from "@/lib/api/server";
import type { CoupleTalk, LessonRead, QuizResult } from "@/lib/api/types";

// Learn's writes go through the server, not the browser client, so that while
// the endpoints still answer 501 the preview mock store they change is the one
// the page reads from: a reload or a switch to the other parent keeps them.
// The API checks the session and the member on every call.

type Result<T> = { ok: true; data: T } | { ok: false };

export async function saveLessonRead(memberId: string, lessonId: string, finished: boolean): Promise<Result<LessonRead>> {
  const api = await serverApi();
  const { data } = await api.PUT("/members/{memberId}/lesson-reads/{lessonId}", { params: { path: { memberId, lessonId } }, body: { finished } });
  return data ? { ok: true, data } : { ok: false };
}

export async function saveQuizAnswer(memberId: string, questionId: string, choiceId: string): Promise<Result<QuizResult>> {
  const api = await serverApi();
  const { data } = await api.POST("/members/{memberId}/quiz-answers", { params: { path: { memberId } }, body: { questionId, choiceId } });
  return data ? { ok: true, data } : { ok: false };
}

export async function saveCoupleTalk(memberId: string, promptId: string): Promise<Result<CoupleTalk>> {
  const api = await serverApi();
  const { data } = await api.POST("/members/{memberId}/couple-talks", { params: { path: { memberId } }, body: { promptId } });
  return data ? { ok: true, data } : { ok: false };
}
