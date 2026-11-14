"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Parent } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Switches the acting parent and keeps the current screen: /family/<id>/rest.
// The whole family layout remounts on switch, so the change is animated by the
// <ViewTransition> around the page, not here. Each parent has their own accent.
export function ParentSwitch({ parents, memberId }: { parents: Parent[]; memberId: string }) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(3).join("/");

  return (
    <div role="group" aria-label="Who is using the app" className="inline-flex rounded-full bg-muted p-1">
      {parents.map((p) => {
        const active = p.id === memberId;
        return (
          <Link
            key={p.id}
            href={`/family/${p.id}${rest ? `/${rest}` : ""}`}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1 text-[13px] font-medium transition-colors duration-150",
              active
                ? cn("bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)]", p.role === "mother" ? "text-mom" : "text-partner")
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.displayName}
          </Link>
        );
      })}
    </div>
  );
}
