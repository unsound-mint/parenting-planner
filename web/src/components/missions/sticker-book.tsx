"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Sticker } from "@/lib/api/types";
import { StickerArt } from "@/components/illustrations";
import { ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { markStickerSeen } from "./actions";

const groupTitle: Record<Sticker["group"], string> = {
  learning: "From learning",
  together: "Together",
  missions: "From missions",
  practice: "From practice",
};
const groups: Sticker["group"][] = ["learning", "together", "missions", "practice"];

/**
 * A sticker on the page. A new one peels in: it arrives lifted and slightly
 * turned with a soft shadow, presses flat, and a quick sheen crosses it. The
 * server remembers that it played (markStickerSeen), so it happens once per
 * sticker. Transform and opacity only; under reduced motion the sticker only
 * fades in.
 */
export function StickerSlot({ sticker, memberId, delay = 0, size = "md" }: { sticker: Sticker; memberId: string; delay?: number; size?: "sm" | "md" }) {
  const [peel] = useState(sticker.new); // fixed for this visit, so marking it seen does not cut the animation short
  const marked = useRef(false);
  useEffect(() => {
    if (!sticker.new || marked.current) return;
    marked.current = true;
    const t = setTimeout(() => void markStickerSeen(memberId, sticker.key), 1500);
    return () => clearTimeout(t);
  }, [sticker.new, sticker.key, memberId]);

  const box = size === "sm" ? "size-16" : "size-24 md:size-28";
  const tilt = (sticker.key.length % 5) - 2; // a little different on each, stable per sticker
  return (
    <li className="flex min-w-0 flex-col items-center gap-2 text-center">
      <div className={cn("relative", box)} style={{ rotate: `${tilt}deg` }}>
        {sticker.earned ? (
          <>
            {peel && (
              <motion.span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-3 rounded-[50%] bg-ink/25 blur-[3px]"
                initial={{ opacity: 0.5, scale: 1.2 }}
                animate={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5, ease: ease.out, delay: delay + 0.4 }}
              />
            )}
            <motion.div
              className="size-full"
              initial={peel ? { opacity: 0, scale: 1.28, rotate: -16, x: 10, y: -22 } : false}
              animate={{ opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 }}
              transition={peel ? { ...spring.playful, delay, opacity: { duration: 0.2, delay } } : undefined}
            >
              <StickerArt art={sticker.art} title={sticker.title} className="size-full drop-shadow-[0_2px_3px_rgb(43_38_32/0.18)]" />
              {peel && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: delay + 0.62 }}
                >
                  <motion.span
                    className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/70"
                    initial={{ x: 0 }}
                    animate={{ x: "420%" }}
                    transition={{ duration: 0.45, ease: ease.inOut, delay: delay + 0.45 }}
                  />
                </motion.span>
              )}
            </motion.div>
          </>
        ) : (
          <StickerArt art={sticker.art} locked className="size-full" />
        )}
      </div>
      <div className="min-w-0">
        <p className={cn("text-label font-semibold text-balance", !sticker.earned && "text-muted-foreground")}>{sticker.title}</p>
        <p className="text-caption text-muted-foreground text-balance">{sticker.blurb}</p>
      </div>
    </li>
  );
}

/** The whole book, in groups. Earned stickers come first in each group; open slots follow and say what earns them. */
export function StickerBookView({ items, memberId }: { items: Sticker[]; memberId: string }) {
  let n = 0;
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => {
        const all = items.filter((s) => s.group === g);
        if (all.length === 0) return null;
        const sorted = [...all.filter((s) => s.earned), ...all.filter((s) => !s.earned)];
        return (
          <section key={g} aria-labelledby={`stickers-${g}`} className="flex flex-col gap-4">
            <h2 id={`stickers-${g}`} className="text-headline">
              {groupTitle[g]}
            </h2>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 @7xl:grid-cols-6">
              {sorted.map((s) => (
                <StickerSlot key={s.key} sticker={s} memberId={memberId} delay={s.new ? 0.25 + 0.35 * n++ : 0} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
