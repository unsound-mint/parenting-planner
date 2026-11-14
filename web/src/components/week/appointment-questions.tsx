import { serverApi } from "@/lib/api/server";
import { QuestionsCard } from "./appointment-questions-card";

// Questions for the next visit, grouped under the appointment they belong to.
// Hidden for caregivers (403) and while the endpoint answers 501 or fails.
export async function AppointmentQuestions({ memberId, partnerName }: { memberId: string; partnerName?: string }) {
  let list;
  try {
    const api = await serverApi();
    list = (await api.GET("/members/{memberId}/appointment-questions", { params: { path: { memberId } } })).data;
  } catch {
    return null;
  }
  if (!list) return null;
  return <QuestionsCard memberId={memberId} partnerName={partnerName} appointments={list.appointments} questions={list.items} />;
}
