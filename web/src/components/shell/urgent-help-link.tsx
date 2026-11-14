/** The fixed help screen, with the acting person so it can show their care team and lead back. */
export const helpHref = (memberId?: string) => (memberId ? `/help?m=${memberId}` : "/help");

// The one entry to the fixed help screen. It looks unlike any other control on
// purpose: the only red in the frame. Never animate it (no press, no transition).
// A plain <a>, not next/link: a full document load is what the service worker
// can answer offline, while a client-side navigation would need the network.
export function UrgentHelpLink({ memberId }: { memberId?: string }) {
  return (
    <a
      href={helpHref(memberId)}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-urgent px-3.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-urgent/40 focus-visible:ring-offset-2 md:h-10 md:px-4.5"
    >
      <span aria-hidden className="size-1.75 rounded-full bg-white" />
      Urgent help
    </a>
  );
}
