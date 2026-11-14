import { Suspense } from "react";
import { redirect } from "next/navigation";

// The journal is the Journal and care screen now; old links land there.
// Params are request data, so the redirect waits inside Suspense.
export default function JournalPage({ params }: PageProps<"/family/[memberId]/care/journal">) {
  return (
    <Suspense>
      <ToCare params={params} />
    </Suspense>
  );
}

async function ToCare({ params }: { params: Promise<{ memberId: string }> }): Promise<never> {
  const { memberId } = await params;
  redirect(`/family/${memberId}/care`);
}
