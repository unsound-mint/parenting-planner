// A sent thank-you card flies to the recipient's chip, the chip pops and a few
// butter dots drift up. Web Animations on transform and opacity only, so it
// stays on the compositor. With reduced motion nothing moves: the card just
// goes. Chips mark themselves with data-thanks-chip="<member id>".

const OUT = "cubic-bezier(0.77, 0, 0.175, 1)"; // --ease-in-out: the card is already on screen
const SOFT = "cubic-bezier(0.23, 1, 0.32, 1)"; // --ease-out

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export async function flyToChip(card: HTMLElement, memberId: string): Promise<void> {
  const chip = document.querySelector<HTMLElement>(`[data-thanks-chip="${memberId}"]`);
  if (reduced()) return;
  const from = card.getBoundingClientRect();
  const to = chip?.getBoundingClientRect();
  // Without a chip on the page (the card is shown elsewhere), it lifts away to the top right.
  const dx = to ? to.left + to.width / 2 - (from.left + from.width / 2) : 48;
  const dy = to ? to.top + to.height / 2 - (from.top + from.height / 2) : -32;
  await card.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0 },
    ],
    { duration: 420, easing: OUT, fill: "forwards" },
  ).finished;
  if (!chip) return;
  chip.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 480, easing: SOFT });
  const r = chip.getBoundingClientRect();
  for (let k = 0; k < 6; k++) {
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    dot.className = "pointer-events-none fixed z-50 size-2 rounded-full bg-butter";
    dot.style.left = `${r.left + r.width / 2 - 4}px`;
    dot.style.top = `${r.top + r.height / 2 - 4}px`;
    document.body.append(dot);
    const angle = -Math.PI / 2 + (k - 2.5) * 0.55;
    const dist = 26 + (k % 2) * 10;
    dot
      .animate(
        [
          { transform: "translate(0, 0) scale(0.5)", opacity: 0 },
          { transform: `translate(${Math.cos(angle) * dist * 0.6}px, ${Math.sin(angle) * dist * 0.6}px) scale(1)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0.8)`, opacity: 0 },
        ],
        { duration: 700, delay: k * 30, easing: SOFT, fill: "backwards" },
      )
      .finished.then(() => dot.remove(), () => dot.remove());
  }
}
