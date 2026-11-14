"use client";

import { Lock, Share2 } from "lucide-react";
import { motion } from "motion/react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ease, spring } from "@/components/joy/motion";
import { NICKNAME_MAX, cleanNickname } from "@/lib/share";
import { cn } from "@/lib/utils";

/**
 * The share card, shown exactly as it will leave the app: the PNG from the
 * week-card route, a switch for the nickname (off by default) and one Share
 * button. Share opens the phone's share sheet with the image file; where the
 * browser cannot share files it downloads the PNG instead.
 *
 * The image comes from the server and is built from this family's own data,
 * so it is requested with the session cookie and never cached.
 */
export function ShareWeekCard({ memberId, shareLine, suggestedNickname }: { memberId: string; shareLine: string; suggestedNickname?: string }) {
  const [useNickname, setUseNickname] = useState(false);
  const [nickname, setNickname] = useState(suggestedNickname ?? "");
  const [busy, setBusy] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState("");
  // Hold the request until typing pauses, so each keystroke does not render a PNG.
  const typed = useDeferredValue(useNickname ? cleanNickname(nickname) : "");
  const src = `/family/${memberId}/week-card${typed ? `?nickname=${encodeURIComponent(typed)}` : ""}`;

  // A new URL fades the old picture down instead of blanking the frame.
  const loaded = loadedSrc === src;

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const file = new File([await res.blob()], "week-card.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareLine });
        return;
      }
      const url = URL.createObjectURL(file);
      const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("Saved the card to your downloads.");
    } catch (e) {
      // Closing the share sheet is not an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) toast.error("Could not make the card. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 @container md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-center">
      {/* The card slides out like a polaroid: it rises into place with a slight turn. */}
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -3 }}
        animate={{ opacity: 1, y: 0, rotate: -1 }}
        transition={{ ...spring.gentle, opacity: { duration: 0.25, ease: ease.out } }}
        className="mx-auto w-full max-w-md rounded-2xl bg-card p-2 shadow-lg ring-1 ring-line"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-family PNG; next/image would cache and resize it */}
        <img
          src={src}
          alt={shareLine}
          width={1080}
          height={1080}
          onLoad={() => setLoadedSrc(src)}
          className={cn("aspect-square w-full rounded-xl bg-sun transition-opacity duration-(--duration-base) ease-(--ease-out)", loaded ? "opacity-100" : "opacity-60")}
        />
      </motion.div>

      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-label font-normal text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>The card shows the week, the picture and where the fact comes from. No photo, no names, no dates.</span>
        </p>

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-label">
          Add a nickname
          <input
            type="checkbox"
            role="switch"
            checked={useNickname}
            onChange={(e) => setUseNickname(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-7 w-12 shrink-0 rounded-full bg-line-2 transition-colors duration-(--duration-base) peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-(--duration-base) after:ease-(--ease-out) peer-checked:after:translate-x-5"
          />
        </label>
        {useNickname && (
          <Input
            aria-label="Nickname on the card"
            value={nickname}
            maxLength={NICKNAME_MAX}
            placeholder="Bean"
            onChange={(e) => setNickname(e.target.value)}
            className="h-11 text-body"
          />
        )}

        <Button size="lg" disabled={busy} onClick={share} className="press h-12 gap-2 text-body font-semibold">
          <Share2 aria-hidden className="size-5" />
          {busy ? "Making the card" : "Share"}
        </Button>
      </div>
    </div>
  );
}
