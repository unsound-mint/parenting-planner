"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A compact dropdown whose options are filter URLs; picking one navigates there. */
export function FilterSelect({ label, value, options, className }: { label: string; value: string; options: { href: string; label: string }[]; className?: string }) {
  const router = useRouter();
  return (
    <label className={cn("relative inline-flex", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => router.push(e.target.value, { scroll: false })}
        className="h-9 w-full cursor-pointer appearance-none rounded-full border border-border bg-card pr-9 pl-3.5 text-label text-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((o) => (
          <option key={o.href} value={o.href}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </label>
  );
}
