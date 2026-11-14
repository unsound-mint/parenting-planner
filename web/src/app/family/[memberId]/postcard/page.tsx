import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Rise } from "@/components/joy/rise";
import { PostcardCard } from "@/components/postcard/postcard-card";
import { PostcardStudio } from "@/components/postcard/postcard-studio";
import { PageFrame } from "@/components/shell/page";
import { serverApi } from "@/lib/api/server";

// The weekly postcard. A grandparent gets the card and the Send love button; a
// parent gets the same card as a preview and the field for this week's line.
// Everything comes from the postcard endpoint, which already applies the
// caregiver permissions: a 403 or 409 simply leaves this page without a card.
export default function PostcardPage({ params }: PageProps<"/family/[memberId]/postcard">) {
  return (
    <Suspense fallback={<PostcardFallback />}>
      <Postcard params={params} />
    </Suspense>
  );
}

async function Postcard({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const [{ data: family, response }, { data: postcard }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/postcard", { params: { path: { memberId } } }),
  ]);
  if (response.status === 401) redirect("/");
  if (!family || !postcard) notFound();
  const parentNames = family.parents.map((p) => p.displayName);
  const isParent = family.parents.some((p) => p.id === memberId);
  const permission = postcard.kind === "pregnancy" ? "pregnancy_updates" : "baby_passport";
  const sharedWith = family.caregivers.filter((c) => c.role === "grandparent" && c.permissions.includes(permission)).map((c) => c.displayName);

  return (
    <PageFrame>
      <Rise i={0} as="header" className="flex flex-col gap-1">
        <h1 className="text-headline">{isParent ? "This week's postcard" : "A postcard for you"}</h1>
        <p className="text-label font-normal text-muted-foreground">
          {isParent ? "What grandparents see each week, in your words." : `From ${parentNames.join(" and ")}, once a week.`}
        </p>
      </Rise>
      <Rise i={1}>
        {isParent ? (
          <PostcardStudio memberId={memberId} postcard={postcard} parentNames={parentNames} sharedWith={sharedWith} />
        ) : (
          <div className="mx-auto w-full max-w-3xl">
            <PostcardCard memberId={memberId} postcard={postcard} parentNames={parentNames} mode="send" />
          </div>
        )}
      </Rise>
    </PageFrame>
  );
}

function PostcardFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-1/3 max-w-xs animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 h-80 max-w-3xl animate-pulse rounded-[2.25rem] bg-muted" />
    </main>
  );
}
