"use client";

import { AppWindow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Parent } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Switches the acting parent and keeps the current screen: /family/<id>/rest.
// The whole family layout remounts on switch, so the change is animated by the
// <ViewTransition> around the page, not here. Each parent has their own accent.
export function ParentSwitch({
  parents,
  memberId,
}: {
  parents: Parent[];
  memberId: string;
}) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(3).join("/");

  // Same cookie, same family: a second window shows the other parent side by side.
  const other = parents.find((p) => p.id !== memberId);

  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label="Who is using the app"
        className="inline-flex rounded-full bg-muted p-1"
      >
        {parents.map((p) => {
          const active = p.id === memberId;
          return (
            <Link
              key={p.id}
              href={`/family/${p.id}${rest ? `/${rest}` : ""}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1 text-label font-medium transition-colors duration-150",
                active
                  ? cn(
                      "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)]",
                      p.role === "mother" ? "text-mom" : "text-partner",
                    )
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.displayName}
            </Link>
          );
        })}
      </div>
      {other && (
        <Link
          href={`/family/${other.id}${rest ? `/${rest}` : ""}`}
          target="_blank"
          rel="noopener"
          aria-label={`Open ${other.displayName} in a new window`}
          className="group/tip relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <AppWindow aria-hidden className="size-4" />
          <span
            aria-hidden
            className="pointer-events-none absolute top-full right-0 z-20 mt-2 rounded-md bg-foreground px-2 py-1 text-caption whitespace-nowrap text-background opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100"
          >
            Open {other.displayName} in a new window
          </span>
        </Link>
      )}
    </div>
  );
}
