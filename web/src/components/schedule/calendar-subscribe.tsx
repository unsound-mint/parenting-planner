"use client";

import { CalendarPlus, Check, Copy, ExternalLink, Link2Off, LockKeyhole, RefreshCw, Rss } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { CalendarFeed, CalendarFeedScope } from "@/lib/api/types";
import { syncNote } from "@/lib/schedule";
import { cn } from "@/lib/utils";

// One secret link per person. The API shows the URL once, when it is created, so
// this card keeps it only in memory: after a reload it can offer a new link or
// revoke, never show the old one again. Calendar apps take a webcal:// address;
// Google Calendar takes it through its "add by URL" link, built here.
const webcal = (url: string) => url.replace(/^https?:/, "webcal:");
const googleLink = (url: string) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal(url))}`;

const scopeLabel: Record<CalendarFeedScope, string> = { mine: "Only mine", family: "Whole family" };

export function CalendarSubscribe({ memberId, initial, canChooseScope }: { memberId: string; initial: CalendarFeed; canChooseScope: boolean }) {
  const [feed, setFeed] = useState<CalendarFeed>(initial);
  const [scope, setScope] = useState<CalendarFeedScope>(initial.scope ?? (canChooseScope ? "family" : "mine"));
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const path = { params: { path: { memberId } } };

  async function create() {
    setBusy(true);
    const { data } = await api.POST("/members/{memberId}/calendar-feed", { ...path, body: { scope } });
    setBusy(false);
    if (data) setFeed(data);
    else toast("Could not create the link", { description: "Nothing changed. Try again in a moment." });
  }

  async function revoke() {
    setBusy(true);
    const { response } = await api.DELETE("/members/{memberId}/calendar-feed", path);
    setBusy(false);
    if (response.ok) {
      setFeed({ active: false });
      toast("Link revoked", { description: "Calendar apps stop updating on their next sync." });
    } else toast("Could not revoke the link", { description: "It is still active. Try again in a moment." });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(webcal(url));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Could not copy the link", { description: "Select it and copy by hand." });
    }
  }

  return (
    <section id="subscribe" aria-labelledby="subscribe-title" className="flex min-w-0 scroll-mt-6 flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Rss className="size-5" />
        </span>
        <h2 id="subscribe-title" className="text-title">
          Subscribe in your calendar app
        </h2>
      </div>

      {!feed.active ? (
        <div className="flex flex-wrap items-center gap-3">
          {canChooseScope && (
            <div role="radiogroup" aria-label="What the calendar shows" className="flex rounded-full bg-muted p-1">
              {(Object.keys(scopeLabel) as CalendarFeedScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scope === s}
                  onClick={() => setScope(s)}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-label outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-8",
                    scope === s ? "bg-card font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {scopeLabel[s]}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={create} disabled={busy} className={primary}>
            <Rss aria-hidden className="size-4" />
            Create my link
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {feed.url ? (
            <>
              <p className="rounded-xl bg-muted px-3 py-2.5 font-mono text-caption break-all select-all" aria-label="Your subscription link">
                {webcal(feed.url)}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(feed.url!)} className={primary}>
                  {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <a href={googleLink(feed.url)} target="_blank" rel="noopener" className={secondary}>
                  <CalendarPlus aria-hidden className="size-4" />
                  Add to Google Calendar
                </a>
                <a href={webcal(feed.url)} className={secondary}>
                  <ExternalLink aria-hidden className="size-4" />
                  Open in Apple or Outlook
                </a>
              </div>
              <p className="text-label text-muted-foreground">
                Shown once. Anyone with this link sees your events, so keep it to yourself.
              </p>
            </>
          ) : (
            <p className="text-label text-muted-foreground">
              A link is active ({feed.scope ? scopeLabel[feed.scope].toLowerCase() : "mine"}), but it is shown only once. Make a new one to add another calendar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={create} disabled={busy} className={ghost}>
              <RefreshCw aria-hidden className="size-4" />
              New link
            </button>
            <button type="button" onClick={revoke} disabled={busy} className={cn(ghost, "text-status-late")}>
              <Link2Off aria-hidden className="size-4" />
              Revoke
            </button>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2 border-t border-border pt-3 text-label text-muted-foreground">
        <li className="flex items-center gap-2">
          <LockKeyhole aria-hidden className="size-4 shrink-0 text-foreground" />
          Psychologist sessions and private visits are never included; shared visits show as &ldquo;Appointment&rdquo;.
        </li>
        <li className="flex items-start gap-2">
          <RefreshCw aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{syncNote}</span>
        </li>
      </ul>
    </section>
  );
}

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-label font-medium outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:min-h-9";
const primary = cn(base, "bg-primary text-primary-foreground hover:bg-primary/85");
const secondary = cn(base, "bg-secondary text-secondary-foreground hover:bg-secondary/70");
const ghost = cn(base, "text-muted-foreground hover:bg-muted hover:text-foreground");
