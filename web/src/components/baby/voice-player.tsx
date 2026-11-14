"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** "0:07", "1:00". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// One voice note: a play button, a bar for how far it has played and the
// length in mono. The audio loads only on the first play (preload none), so a
// card with a note costs nothing until someone listens. Key it by src when the
// source can change, so the state starts fresh.
export function VoicePlayer({ src, durationSeconds, label = "Voice note", className }: { src: string; durationSeconds?: number; label?: string; className?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(durationSeconds ?? 0);
  const [failed, setFailed] = useState(false);

  const progress = length > 0 ? Math.min(1, at / length) : 0;

  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-xl bg-muted px-2 py-1.5", className)}>
      <button
        type="button"
        aria-label={`${playing ? "Pause" : "Play"}: ${label}`}
        disabled={failed}
        onClick={() => {
          const a = audio.current;
          if (!a) return;
          if (a.paused) a.play().catch(() => setFailed(true));
          else a.pause();
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 ease-(--ease-out) outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:opacity-50 md:size-9"
      >
        {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4 translate-x-px" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-caption font-medium text-muted-foreground">{failed ? "This voice note will not play" : label}</span>
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-border">
          <span className="block h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${progress})` }} />
        </span>
      </div>
      <span className="shrink-0 font-mono text-caption text-muted-foreground">{playing || at > 0 ? `${clock(at)} / ${clock(length)}` : clock(length)}</span>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          // MediaRecorder webm often reports Infinity; keep the measured length then.
          if (Number.isFinite(e.currentTarget.duration)) setLength(e.currentTarget.duration);
        }}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
      />
    </div>
  );
}
