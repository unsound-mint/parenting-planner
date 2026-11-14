import { redirect } from "next/navigation";

// The journal is the Journal and care screen now; old links land there.
export default async function JournalPage({ params }: PageProps<"/family/[memberId]/care/journal">) {
  const { memberId } = await params;
  redirect(`/family/${memberId}/care`);
}
