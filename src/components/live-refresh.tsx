"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches server components every few seconds so a change made on one
// parent's screen shows up on the other's without a reload. Polling is enough
// for a two-person demo and avoids running a websocket server.
export function LiveRefresh({ intervalMs = 2500 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
