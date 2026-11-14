"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const className = "inline-flex min-h-11 items-center gap-2 text-label font-medium underline-offset-4 hover:underline";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Back to the screen of the person who opened help (?m=), or to the family picker. */
export function BackLink() {
  const m = useSearchParams().get("m");
  return (
    <Link href={m && UUID.test(m) ? `/family/${m}` : "/family"} className={className}>
      <ArrowLeft aria-hidden className="size-4" />
      Back
    </Link>
  );
}

export function BackLinkFallback() {
  return (
    <Link href="/family" className={className}>
      <ArrowLeft aria-hidden className="size-4" />
      Back
    </Link>
  );
}
