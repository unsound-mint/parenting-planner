import { Suspense } from "react";
import { serverApi } from "@/lib/api/server";
import type { Family } from "@/lib/api/types";
import { LoveInbox } from "./love-inbox";
import { PostcardCard } from "./postcard-card";

// Drop-in slots for This week. Each starts its own request and renders nothing
// when the postcard does not apply (planning stage, a nanny, no permission),
// so a missing postcard never changes the rest of the page.

/** A parent's This week: the hearts received. Put it in the aside. */
export function LoveInboxSlot({ memberId, family }: { memberId: string; family: Family }) {
  return (
    <Suspense fallback={null}>
      <LoveInboxLoader memberId={memberId} family={family} />
    </Suspense>
  );
}

async function LoveInboxLoader({ memberId, family }: { memberId: string; family: Family }) {
  const api = await serverApi();
  const { data } = await api.GET("/members/{memberId}/postcard", { params: { path: { memberId } } }).catch(() => ({ data: undefined }));
  if (!data) return null;
  const grandparent = family.caregivers.find((c) => c.role === "grandparent");
  return <LoveInbox loves={data.loves} postcardHref={`/family/${memberId}/postcard`} grandparentName={grandparent?.displayName} />;
}

/** A grandparent's home: the postcard with the Send love button. */
export function PostcardSlot({ memberId, family }: { memberId: string; family: Family }) {
  return (
    <Suspense fallback={null}>
      <PostcardLoader memberId={memberId} family={family} />
    </Suspense>
  );
}

async function PostcardLoader({ memberId, family }: { memberId: string; family: Family }) {
  const api = await serverApi();
  const { data } = await api.GET("/members/{memberId}/postcard", { params: { path: { memberId } } }).catch(() => ({ data: undefined }));
  if (!data) return null;
  return <PostcardCard memberId={memberId} postcard={data} parentNames={family.parents.map((p) => p.displayName)} mode="send" />;
}
