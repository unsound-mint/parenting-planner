import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { optional } from "@/components/today/slots";
import { SoftCard } from "@/components/joy/soft-card";
import { Envelope } from "./envelope";

/**
 * Entry to the time capsule, for Baby and (before a child is born) Learn.
 * Reads the letters itself, so render it inside <Suspense>.
 */
export async function CapsuleLink({ memberId, childName }: { memberId: string; childName?: string }) {
  const api = await serverApi();
  const letters = await optional(api.GET("/members/{memberId}/letters", { params: { path: { memberId } } }));
  if (!letters) return null;
  const n = letters.items.length;
  return (
    <Link href={`/family/${memberId}/baby/letters`} className="lift group block rounded-[1.75rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <SoftCard tone="sun" className="flex items-center gap-5">
        <Envelope tone="me" opened={false} delay={0.1} className="w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">Time capsule</p>
          <h2 className="mt-1 text-headline">Letters {childName ? `to ${childName}` : "to your baby"}</h2>
          <p className="mt-1 text-body text-ink-2">{n > 0 ? `${n} sealed ${n === 1 ? "letter is" : "letters are"} waiting for their day.` : "Write one now and choose the day it opens."}</p>
        </div>
        <ArrowRight className="size-5 shrink-0 text-ink-2" aria-hidden />
      </SoftCard>
    </Link>
  );
}
