import Link from "next/link";
import type { Sticker } from "@/lib/api/types";
import { StickerArt } from "@/components/illustrations";

/** A small row of the newest earned stickers with a link to the whole book. Always has something to show: with none earned yet it shows two open slots. */
export function StickerShelf({ items, memberId, className }: { items: Sticker[]; memberId: string; className?: string }) {
  const earned = items.filter((s) => s.earned);
  const shown = earned.length > 0 ? earned.slice(-4) : items.slice(0, 3);
  return (
    <Link href={`/family/${memberId}/learn/stickers`} className={`group flex min-h-11 items-center gap-3 rounded-full border border-line bg-card py-1.5 pr-4 pl-2 press ${className ?? ""}`}>
      <span className="flex -space-x-2">
        {shown.map((s, i) => (
          <StickerArt key={s.key} art={s.art} locked={!s.earned} className="size-10 drop-shadow-[0_1px_2px_rgb(43_38_32/0.2)]" style={{ rotate: `${(i % 3) * 4 - 4}deg` }} />
        ))}
      </span>
      <span className="text-label font-semibold">{earned.length > 0 ? "Your sticker book" : "Start your sticker book"}</span>
    </Link>
  );
}
