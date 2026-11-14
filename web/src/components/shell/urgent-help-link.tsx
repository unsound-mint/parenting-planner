/** The fixed help screen, with the acting person so it can show their care team and lead back. */
export const helpHref = (memberId?: string) => (memberId ? `/help?m=${memberId}` : "/help");

// The one entry to the fixed help screen. It looks unlike any other control on
// purpose: dark, with the only red in the frame. Never animate it.
// A plain <a>, not next/link: a full document load is what the service worker
// can answer offline, while a client-side navigation would need the network.
export function UrgentHelpLink({ memberId }: { memberId?: string }) {
  return (
    <a
      href={helpHref(memberId)}
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-[#ff8a80]" />
      Urgent help
    </a>
  );
}
