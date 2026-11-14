"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoicePlayer, clock } from "./voice-player";

// The API takes at most 1 MB (413 above). Stop a little before it, and at a
// minute, whichever comes first; at 32 kbit/s a minute is about 240 KB.
export const VOICE_MAX_BYTES = 1024 * 1024;
const STOP_BYTES = 950 * 1024;
const MAX_SECONDS = 60;
const BITRATE = 32_000;
// Held longer than this, the press is a hold and letting go stops the recording.
const HOLD_MS = 400;
// Chrome and Firefox record webm, Safari mp4; the API accepts these.
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type Recording = { blob: Blob; durationSeconds: number };
type State = "idle" | "asking" | "recording" | "denied" | "missing" | "failed";

const noSubscribe = () => () => {};
// Server render assumes a microphone; the browser checks for real.
const canRecord = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

// Hold to record and let go to stop, or tap to start and tap again to stop.
// Without a microphone (no MediaRecorder, an insecure page, permission denied)
// it says so in one line and the written note still works.
export function VoiceRecorder({ value, onChange, disabled }: { value: Recording | null; onChange: (r: Recording | null) => void; disabled?: boolean }) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [bytes, setBytes] = useState(0);
  const supported = useSyncExternalStore(noSubscribe, canRecord, () => true);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const pressedAt = useRef(0);
  const releasedEarly = useRef(false);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // A blob URL for the review player, released when the recording changes.
  const url = useMemo(() => (value ? URL.createObjectURL(value.blob) : null), [value]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  function release() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function start() {
    setState("asking");
    releasedEarly.current = false;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "missing" : "failed");
      return;
    }
    stream.current = media;
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(media, { mimeType, audioBitsPerSecond: BITRATE });
    recorder.current = rec;
    const chunks: Blob[] = [];
    let size = 0;
    const began = performance.now();
    rec.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      chunks.push(e.data);
      size += e.data.size;
      setBytes(size);
      if (size >= STOP_BYTES) stop();
    };
    rec.onstop = () => {
      release();
      const durationSeconds = Math.max(1, Math.round((performance.now() - began) / 1000));
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
      if (blob.size === 0) {
        setState("idle");
        return;
      }
      setState("idle");
      onChange({ blob, durationSeconds });
    };
    rec.start(250);
    setElapsed(0);
    setBytes(0);
    setState("recording");
    timer.current = window.setInterval(() => {
      const s = (performance.now() - began) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS) stop();
    }, 200);
    // Let go during the permission prompt after a long press: treat it as a hold.
    if (releasedEarly.current) stop();
  }

  if (!supported) return null;

  if (state === "denied" || state === "missing" || state === "failed") {
    return (
      <p className="flex items-center gap-2 text-label font-normal text-muted-foreground">
        <MicOff aria-hidden className="size-4 shrink-0" />
        {state === "denied"
          ? "The microphone is off for this site, so write the note instead."
          : state === "missing"
            ? "No microphone found. Write the note instead."
            : "The microphone did not start. Write the note instead."}
      </p>
    );
  }

  if (value && url) {
    return (
      <div className="flex items-center gap-2">
        <VoicePlayer key={url} src={url} durationSeconds={value.durationSeconds} label={`Your voice note, ${Math.max(1, Math.round(value.blob.size / 1024))} KB`} className="flex-1" />
        <button
          type="button"
          aria-label="Delete the voice note"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  const recording = state === "recording";
  const timeShare = Math.min(1, elapsed / MAX_SECONDS);
  const sizeShare = Math.min(1, bytes / VOICE_MAX_BYTES);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled || state === "asking"}
        aria-pressed={recording}
        aria-label={recording ? "Stop recording" : "Record a voice note"}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (recording) {
            pressedAt.current = Infinity;
            stop();
            return;
          }
          pressedAt.current = performance.now();
          void start();
        }}
        onPointerUp={() => {
          if (performance.now() - pressedAt.current < HOLD_MS) return;
          if (recorder.current?.state === "recording") stop();
          else releasedEarly.current = true;
          pressedAt.current = Infinity;
        }}
        onClick={(e) => {
          // Keyboard only (Enter or Space); pointers are handled above.
          if (e.detail !== 0) return;
          if (recording) stop();
          else void start();
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "flex size-11 shrink-0 touch-none items-center justify-center rounded-full border transition-[transform,background-color] duration-150 ease-(--ease-out) outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:opacity-60",
          recording ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted",
        )}
      >
        {recording ? <Square aria-hidden className="size-4 fill-current" /> : <Mic aria-hidden className="size-5" />}
      </button>
      {recording ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1" role="status" aria-live="polite">
          <span className="flex items-center justify-between gap-2 text-caption">
            <span className="flex items-center gap-1.5 font-medium">
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-primary" />
              Recording
            </span>
            <span className="font-mono text-muted-foreground">
              {clock(elapsed)} / {clock(MAX_SECONDS)}
            </span>
          </span>
          {/* One bar for whichever limit is closer: a minute or 1 MB. */}
          <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${Math.max(timeShare, sizeShare)})` }} />
          </span>
          <span className="self-end font-mono text-caption text-muted-foreground">{Math.round(bytes / 1024)} KB of 1 MB</span>
        </div>
      ) : (
        <span className="text-label font-normal text-muted-foreground">{state === "asking" ? "Allow the microphone to record" : "Hold or tap to record, up to a minute"}</span>
      )}
    </div>
  );
}
