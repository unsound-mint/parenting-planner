import Link from "next/link";
import { RotateCcw } from "lucide-react";

// Reset: a new demo makes a fresh copy of a family at the real date, so going
// back to the start page is the reset. The old copy stays with its cookie until
// the new one replaces it.
export function ResetDemo() {
  return (
    <Link
      href="/"
      title="Start over with a fresh family"
      className="order-4 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-label font-medium outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-8"
    >
      <RotateCcw className="size-3.5" aria-hidden />
      Reset demo
    </Link>
  );
}
