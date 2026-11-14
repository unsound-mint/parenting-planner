import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Face } from "@/components/illustrations";

/**
 * The way into Virtual Baby from Learn: one small card, no data of its own
 * (Learn's fetches stay as they are). The sleeping baby is drawn inline and
 * still, since the whole card is a link.
 */
export function VirtualBabyEntry({ memberId }: { memberId: string }) {
  return (
    <Link
      href={`/family/${memberId}/learn/virtual-baby`}
      className="press lift group flex min-w-0 items-center gap-4 rounded-3xl bg-sun p-4 pr-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:gap-5 md:p-5 md:pr-6"
    >
      <svg viewBox="70 20 160 160" className="size-20 shrink-0 md:size-24" aria-hidden focusable="false">
        <path d="M82 150c0-30 136-30 136 0l-4 30H86z" fill="#D8EDEB" />
        <path d="M88 168c42 17 82 17 124 0" stroke="#7DBAB6" strokeWidth="9" strokeLinecap="round" fill="none" />
        <circle cx="150" cy="98" r="54" fill="#F6C9A6" />
        <path d="M98 90c0-42 104-42 104 0-31-13-73-13-104 0z" fill="#F4CD6A" />
        <circle cx="150" cy="44" r="9" fill="#F2B84B" />
        <Face x={150} y={110} s={0.88} expression="asleep" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block text-caption font-semibold tracking-wider text-ink-2 uppercase">Virtual Baby</span>
        <span className="mt-1 block text-title">Practise a newborn evening, together</span>
        <span className="mt-1 block text-label font-normal text-muted-foreground">Feeds, diapers, safe sleep and crying, with a kind answer for every choice. Or try the 48-hour challenge.</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-ink-2 transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
