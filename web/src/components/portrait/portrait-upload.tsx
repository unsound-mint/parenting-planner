"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { childAgeLabel, type Slot } from "./frames";

// The browser shrinks the photo before it leaves the phone: at most 1600 px on
// the long side, JPEG. The API re-encodes it again (and drops EXIF) whatever
// arrives, so this is about upload size, not trust.
const MAX_SIDE = 1600;
const MAX_BYTES = 1536 * 1024;

async function shrink(file: File): Promise<Blob> {
  // from-image applies the camera's rotation before the EXIF is lost.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.86, 0.72, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("too large");
}

/**
 * The invitation to add this month's portrait (or this week's bump photo):
 * pick or take a photo, see it, add it. The privacy line sits on the card
 * itself, where the photo is chosen.
 */
export function PortraitUpload({
  memberId,
  slot,
  onUploaded,
}: {
  memberId: string;
  slot: Slot;
  /** Called with the frame label of the new photo ("2 months", "Week 25"). */
  onUploaded: (label: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ blob: Blob; url: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url);
  }, [picked]);

  async function choose(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await shrink(file);
      setPicked({ blob, url: URL.createObjectURL(blob) });
    } catch {
      toast.error("This photo could not be opened here. Try a JPEG, PNG or WebP from your camera roll.");
    }
  }

  function upload() {
    if (!picked) return;
    startTransition(async () => {
      const { error, response } = await api.POST("/members/{memberId}/portraits", {
        params: { path: { memberId }, query: { childId: slot.childId, month: slot.month, week: slot.week } },
        // Raw JPEG, not JSON: the API reads the bytes as they are.
        body: picked.blob as unknown as string,
        bodySerializer: (b) => b as unknown as BodyInit,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (error) {
        toast.error(
          response.status === 413
            ? "The photo is still over 1.5 MB after shrinking. Try another one."
            : "The photo did not upload. Please try again.",
        );
        return;
      }
      setPicked(null);
      toast.success("Added to the flipbook.");
      onUploaded(slot.month !== undefined ? childAgeLabel(slot.month) : `Week ${slot.week}`);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line-2 p-4">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {picked ? (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picked.url} alt="The photo you picked" className="pp-flip-land aspect-[4/5] w-20 shrink-0 rounded-xl object-cover" />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-label font-medium">{slot.title}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={upload}
                disabled={pending}
                className="press inline-flex min-h-11 items-center rounded-full bg-me px-4 text-label font-medium text-card disabled:opacity-60 md:min-h-9"
              >
                {pending ? "Adding…" : "Add to the flipbook"}
              </button>
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={pending}
                className="press inline-flex min-h-11 items-center rounded-full border border-line-2 px-4 text-label font-medium text-ink-2 hover:bg-muted md:min-h-9"
              >
                Choose another
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="press group flex items-center gap-3 rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-me-soft text-me">
            <Camera aria-hidden className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-label font-medium text-ink group-hover:underline">{slot.title}</span>
            <span className={cn("text-label font-normal text-muted-foreground")}>
              {slot.hasPhoto ? "Retake it, or keep the one you have" : "Take it or pick one from your photos"}
            </span>
          </span>
        </button>
      )}
      {slot.next && <p className="text-label font-normal text-ink-2">{slot.next}</p>}
      <p className="flex items-start gap-1.5 text-caption text-leaf">
        <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
        Only your family sees this; it is deleted when the demo ends.
      </p>
    </div>
  );
}
