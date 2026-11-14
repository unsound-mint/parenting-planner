import { cn } from "@/lib/utils";

/**
 * Two speech bubbles that overlap, one in each parent's accent. Flat shapes,
 * no text. The hero's one illustration; it is decorative, so hidden from screen readers.
 */
export function LabArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" aria-hidden className={cn("h-auto w-full", className)}>
      <g className="lab-art-left">
        <path d="M24 28a20 20 0 0 1 20-20h86a20 20 0 0 1 20 20v52a20 20 0 0 1-20 20H78l-26 20v-20h-8a20 20 0 0 1-20-20Z" className="fill-me" />
        <circle cx="62" cy="54" r="6" fill="#fff" opacity=".9" />
        <circle cx="87" cy="54" r="6" fill="#fff" opacity=".9" />
        <circle cx="112" cy="54" r="6" fill="#fff" opacity=".9" />
      </g>
      <g className="lab-art-right">
        <path d="M216 84a20 20 0 0 0-20-20h-70a20 20 0 0 0-20 20v46a20 20 0 0 0 20 20h54l24 18v-18h-8a20 20 0 0 0 20-20Z" className="fill-them" opacity=".95" />
        <path d="M136 108c8-14 22-14 30 0 8-14 22-14 30 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".9" />
      </g>
      <path d="m206 22 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" className="fill-butter" />
    </svg>
  );
}
