"use client";

import "./portrait.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MoveHorizontal, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";
import type { Frame, Slot } from "./frames";
import { PortraitDrawing } from "./portrait-drawing";
import { PortraitUpload } from "./portrait-upload";

// One page every 420 ms: fast enough to read as growing, slow enough that each
// age is seen. A drag flips one page per 32 px.
const STEP_MS = 420;
const DRAG_PX = 32;

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduce(onChange: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Waits until every photo is decoded, so autoplay never flips onto a blank page. */
async function decodeAll(frames: Frame[]) {
  await Promise.all(
    frames
      .filter((f) => f.src)
      .map((f) => {
        const img = new Image();
        img.src = f.src!;
        return img.decode().catch(() => undefined);
      }),
  );
}

export function FlipbookPlayer({
  memberId,
  title,
  frames,
  slot,
  canEdit,
  className,
}: {
  memberId: string;
  title: string;
  frames: Frame[];
  /** The upload card's slot, for parents. */
  slot?: Slot;
  /** Parents may remove a photo; caregivers only look. */
  canEdit: boolean;
  className?: string;
}) {
  const router = useRouter();
  const last = frames.length - 1;
  // Until someone flips (or autoplay runs) the book rests on the oldest page, so
  // the one autoplay grows forward. Reduced motion never autoplays: it rests on
  // the newest page. The server renders the oldest.
  const reduce = useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
  const [picked, setIndex] = useState<number | null>(null);
  const index = picked ?? (reduce ? last : 0);
  const [landed, setLanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const played = useRef(false);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const focusSlot = useRef<string | null>(null);

  const current = frames[Math.min(index, last)];

  function stop() {
    clearInterval(timer.current);
    timer.current = undefined;
  }

  function play() {
    stop();
    if (frames.length < 2) return;
    setConfirmDelete(false);
    setIndex(0);
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setIndex(i);
      if (i >= last) stop();
    }, STEP_MS);
  }

  // Autoplay once, when most of the book is on screen and its photos are ready.
  useEffect(() => {
    if (window.matchMedia(REDUCE).matches) return;
    const el = stageRef.current;
    if (!el || frames.length < 2) return;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || played.current) return;
        played.current = true;
        io.disconnect();
        await decodeAll(frames);
        play();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stop();
    };
    // Only on mount: a new photo should not replay the whole book.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After an upload the server sends the new series: open it at the new photo.
  useEffect(() => {
    if (!focusSlot.current) return;
    const i = frames.findIndex((f) => f.label === focusSlot.current && f.src);
    if (i < 0) return;
    focusSlot.current = null;
    stop();
    setIndex(i);
    setLanded(frames[i].id);
  }, [frames]);

  function go(i: number) {
    stop();
    setConfirmDelete(false);
    setIndex(Math.max(0, Math.min(last, i)));
  }

  function onPointerDown(e: React.PointerEvent) {
    stop();
    drag.current = { x: e.clientX, from: index };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    // Dragging left turns pages forward, like a book.
    const pages = Math.round((drag.current.x - e.clientX) / DRAG_PX);
    const next = Math.max(0, Math.min(last, drag.current.from + pages));
    if (next !== index) {
      setConfirmDelete(false);
      setIndex(next);
    }
  }

  function onPointerUp() {
    drag.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(last);
    else return;
    e.preventDefault();
  }

  async function remove(frame: Frame) {
    const { response } = await api.DELETE("/members/{memberId}/portraits/{portraitId}", {
      params: { path: { memberId, portraitId: frame.id } },
    });
    setConfirmDelete(false);
    if (!response.ok) {
      toast.error("The photo was not removed. Please try again.");
      return;
    }
    toast.success("Photo removed. It is gone from the family's flipbook.");
    router.refresh();
  }

  return (
    <SoftCard as="section" aria-labelledby="portrait-title" className={cn("@container flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="portrait-title" className="text-title">
          {title}
        </h2>
        {frames.length > 1 && (
          <button
            type="button"
            onClick={play}
            className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-label font-medium text-ink-2 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9"
          >
            <Play aria-hidden className="size-3.5" />
            Play
          </button>
        )}
      </div>

      <div className="grid min-w-0 gap-5 @xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @xl:items-start">
        {frames.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div
              ref={stageRef}
              role="group"
              aria-roledescription="flipbook"
              aria-label={`${title}. ${current.label}, page ${index + 1} of ${frames.length}. Use the arrow keys to flip.`}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative aspect-[4/5] w-full cursor-grab touch-pan-y overflow-hidden rounded-3xl border border-line bg-card outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            >
              {frames.map((f, i) => (
                <div
                  key={f.id}
                  className="pp-flip-page bg-card"
                  data-state={i < index ? "past" : i === index ? "current" : "future"}
                  aria-hidden={i !== index}
                >
                  <div className={cn("size-full", landed === f.id && "pp-flip-land")}>
                    {f.src ? (
                      // A plain img: the session cookie must go with the request, and the API already serves a small JPEG.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.src} alt="" draggable={false} className="size-full object-cover" width={f.width} height={f.height} />
                    ) : (
                      <PortraitDrawing drawing={f.drawing} className="size-full" />
                    )}
                  </div>
                </div>
              ))}
              <p className="absolute bottom-3 left-3 z-10 flex items-baseline gap-2 rounded-full bg-card/90 px-3 py-1.5" aria-hidden>
                <span className="font-mono text-label font-medium tracking-wide text-ink uppercase">{current.label}</span>
                <span className="font-mono text-caption text-muted-foreground">{current.when}</span>
              </p>
              {current.src && canEdit && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => (confirmDelete ? remove(current) : setConfirmDelete(true))}
                  aria-label={confirmDelete ? `Remove the ${current.label} photo for good` : `Remove the ${current.label} photo`}
                  className={cn(
                    "press absolute top-3 right-3 z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-card/90 px-3 text-label font-medium text-ink-2 hover:bg-card",
                    confirmDelete && "text-mom",
                  )}
                >
                  <Trash2 aria-hidden className="size-4" />
                  {confirmDelete ? "Remove?" : <span className="sr-only">Remove</span>}
                </button>
              )}
            </div>
            {frames.length > 1 && (
              <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <MoveHorizontal aria-hidden className="size-3.5" />
                Drag across the picture to flip
              </p>
            )}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-5">
          {frames.length > 1 && (
            <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Pages">
              {frames.map((f, i) => (
                <li key={f.id} className="min-w-9 max-w-12 flex-1 basis-0">
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`${f.label}, ${f.when}`}
                    aria-current={i === index ? "true" : undefined}
                    className={cn(
                      "press flex w-full flex-col items-center gap-1 rounded-xl p-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                  >
                    <span
                      className={cn(
                        "block aspect-[4/5] w-full overflow-hidden rounded-lg border bg-card transition-[opacity] duration-150",
                        i === index ? "border-me ring-2 ring-me" : "border-line opacity-70 hover:opacity-100",
                      )}
                    >
                      {f.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.src} alt="" draggable={false} className="size-full object-cover" />
                      ) : (
                        <PortraitDrawing drawing={f.drawing} className="size-full" />
                      )}
                    </span>
                    <span className={cn("font-mono text-[0.625rem] leading-3", i === index ? "text-ink" : "text-muted-foreground")}>
                      {shortLabel(f.label)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {slot && (
            <PortraitUpload
              memberId={memberId}
              slot={slot}
              onUploaded={(label) => {
                focusSlot.current = label;
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
    </SoftCard>
  );
}

/** "Week 24" → "W24", "2 months" → "2M", "4 years" → "4Y", "Birth" → "0". */
function shortLabel(label: string) {
  if (label === "Birth") return "BIRTH";
  const [n, unit] = label.split(" ");
  if (label.startsWith("Week")) return `W${unit}`;
  return `${n}${unit.startsWith("year") ? "Y" : "M"}`;
}
