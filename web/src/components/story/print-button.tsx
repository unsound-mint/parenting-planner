"use client";

import { Printer } from "lucide-react";

/** Print or save the book as a PDF; the reveal CSS shows every page in print. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-line-2 bg-card px-4 text-label text-ink-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 print:hidden"
    >
      <Printer className="size-4" strokeWidth={1.8} aria-hidden />
      Print or save as PDF
    </button>
  );
}
