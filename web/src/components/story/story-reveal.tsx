"use client";

import { useEffect, useRef } from "react";
import "./story.css";

// Gaps between elements that scroll in together: the first follows at once,
// later ones close up, so a batch reads as one wave, not a metronome. A batch
// never takes longer than about 300 ms to start its last element.
const GAPS = [0, 70, 60, 50, 40, 35, 30];
const delayFor = (n: number) => GAPS.slice(0, n + 1).reduce((a, b) => a + b, 0) + Math.max(0, n - GAPS.length + 1) * 25;

/**
 * Reveals [data-reveal] descendants once, as they scroll into view: it sets
 * data-shown and a --reveal-delay for the elements that arrive in the same
 * frame. The CSS in story.css does the motion (transform and opacity). Elements
 * that are already shown never hide again, so scrolling back up is calm.
 */
export function StoryReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
    const show = (el: HTMLElement, delay: number) => {
      el.style.setProperty("--reveal-delay", `${delay}ms`);
      el.dataset.shown = "";
    };
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => show(el, 0));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const arriving = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          // Document order is reading order: top first, then left to right.
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        arriving.forEach((el, n) => {
          show(el, delayFor(n));
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
