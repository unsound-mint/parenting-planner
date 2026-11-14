"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { LiveUpdate, LiveUpdateKind } from "@/lib/api/types";

// What each kind of change can show on: every kind redraws the server-rendered
// screens, so one list is enough. A kind the web app does not know yet is ignored.
const KINDS: Record<LiveUpdateKind, true> = {
  family: true,
  task: true,
  shift: true,
  calendar_event: true,
  care_log: true,
  handoff: true,
  appointment_question: true,
  invitation: true,
  notification: true,
  leave_plan: true,
  diary_entry: true,
  insurance_call: true,
};

const DEBOUNCE_MS = 300;

/**
 * Opens the acting person's SSE stream once (mounted in the family layout) and
 * refreshes the server components when something changes. The events are hints
 * with no content (LiveUpdate in api/openapi.yaml), so the screen refetches.
 * Fails silently: an endpoint that answers 501 leaves the EventSource closed
 * and the screens simply do not live-update. A dropped connection reconnects on
 * its own and refreshes once when it is back.
 */
export function LiveUpdates({ memberId }: { memberId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dropped = false;
    let stale = false;

    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // A hidden tab refreshes when it becomes visible instead.
        if (document.hidden) {
          stale = true;
          return;
        }
        stale = false;
        router.refresh();
      }, DEBOUNCE_MS);
    };

    const source = new EventSource(`/api/members/${memberId}/live`);
    // The stream names its events "update", so onmessage would never fire.
    source.addEventListener("update", (e) => {
      try {
        const hint = JSON.parse((e as MessageEvent<string>).data) as Partial<LiveUpdate>;
        // Own changes refresh too: the debounce absorbs the echo and a second window of the same person stays in sync.
        if (hint.kind && hint.kind in KINDS) refresh();
      } catch {
        // A malformed hint is not worth a refresh.
      }
    });
    source.onopen = () => {
      if (dropped) {
        dropped = false;
        refresh();
      }
    };
    source.onerror = () => {
      // CLOSED: the server refused (501, 403, 404) and the browser will not retry. Stay quiet.
      if (source.readyState === EventSource.CLOSED) clearTimeout(timer);
      else dropped = true;
    };

    const onVisible = () => {
      if (!document.hidden && stale) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(timer);
      source.close();
    };
  }, [memberId, router]);

  return null;
}
