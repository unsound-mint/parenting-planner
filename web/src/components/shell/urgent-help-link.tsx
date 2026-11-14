import Link from "next/link";

// The one entry to the fixed help screen. It looks unlike any other control on
// purpose: dark, with the only red in the frame. Never animate it.
export function UrgentHelpLink() {
  return (
    <Link
      href="/help"
      className="inline-flex h-8 items-center gap-2 rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-[#ff8a80]" />
      Urgent help
    </Link>
  );
}
