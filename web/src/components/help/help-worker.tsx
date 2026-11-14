"use client";

import { useEffect } from "react";

// Registers the service worker that keeps /help available offline
// (app/sw.js/route.ts). Off in development unless NEXT_PUBLIC_HELP_SW=1, so it
// never caches dev builds by surprise.
const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_HELP_SW === "1";

export function HelpWorker() {
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
