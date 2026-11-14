"use client";

import { Popover } from "@base-ui/react/popover";
import { AppWindow, Check, Copy, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { pathFor, type Person } from "@/lib/roles";
import { roleAccent, roleIcon, roleLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// Switches the acting person and keeps the current screen where that person may
// open it. The family layout remounts on switch, so the change is animated by the
// <ViewTransition> around the page, not here. Only people the API returned are listed.
// The group and the window button are siblings: the family header orders them (order-* classes).
export function RoleSwitch({ people, memberId }: { people: Person[]; memberId: string }) {
  const screen = usePathname().split("/")[3] ?? "";

  return (
    <>
      <div
        role="group"
        aria-label="Who is using the app"
        className="order-1 grid w-full min-w-0 gap-1 rounded-2xl bg-muted p-1 md:flex md:w-auto md:rounded-full"
        style={{ gridTemplateColumns: `repeat(${people.length}, minmax(0, 1fr))` }}
      >
        {people.map((p) => {
          const active = p.id === memberId;
          const Icon = roleIcon[p.role];
          return (
            <Link
              key={p.id}
              href={pathFor(p, screen)}
              aria-current={active ? "true" : undefined}
              title={`${roleLabel[p.role]}: ${p.displayName}`}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9 md:flex-row md:gap-2 md:rounded-full md:py-1 md:pr-3 md:pl-1",
                active
                  ? "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-card",
                  roleAccent[p.role].bg,
                )}
              >
                {p.displayName.charAt(0).toUpperCase()}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1 text-caption font-medium md:text-label",
                  active && roleAccent[p.role].text,
                )}
              >
                <Icon aria-hidden className="size-3 shrink-0 md:size-3.5" />
                {roleLabel[p.role]}
              </span>
            </Link>
          );
        })}
      </div>
      <WindowLinks people={people} screen={screen} />
    </>
  );
}

// One row per person: open their view in a new window, or copy the link.
// Same browser, same cookie, same demo family: a second window shows another
// person side by side. A link sent to another device has no session and lands on
// the start page, so the panel says so.
function WindowLinks({ people, screen }: { people: Person[]; screen: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(p: Person) {
    const url = `${window.location.origin}${pathFor(p, screen)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(p.id);
      setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1800);
      toast(`Link for ${roleLabel[p.role]} copied`, { description: "Opens in this browser only." });
    } catch {
      toast("Could not copy the link", { description: "Use Open in a new window instead." });
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Open a role in its own window"
        title="Open a role in its own window"
        className="order-5 ml-auto flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:bg-muted data-[popup-open]:text-foreground md:order-2 md:ml-0 md:size-9"
      >
        <MonitorSmartphone aria-hidden className="size-4.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none">
            <Popover.Title className="px-2 pt-1 text-label font-semibold">Each role in its own window</Popover.Title>
            <Popover.Description className="px-2 pb-2 text-caption text-muted-foreground">
              Works in this browser, where your demo family lives.
            </Popover.Description>
            <ul>
              {people.map((p) => {
                const Icon = roleIcon[p.role];
                return (
                  <li key={p.id} className="flex items-center gap-1 rounded-xl pl-2">
                    <Icon aria-hidden className={cn("size-4 shrink-0", roleAccent[p.role].text)} />
                    <span className="min-w-0 flex-1 truncate text-label">
                      {roleLabel[p.role]}
                      <span className="text-muted-foreground"> · {p.displayName}</span>
                    </span>
                    <Link
                      href={pathFor(p, screen)}
                      target="_blank"
                      rel="noopener"
                      aria-label={`Open ${roleLabel[p.role]} in a new window`}
                      title="Open in a new window"
                      className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9"
                    >
                      <AppWindow aria-hidden className="size-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => copy(p)}
                      aria-label={`Copy link for ${roleLabel[p.role]}`}
                      title="Copy link"
                      className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9"
                    >
                      {copied === p.id ? <Check aria-hidden className="size-4 text-status-ok" /> : <Copy aria-hidden className="size-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
