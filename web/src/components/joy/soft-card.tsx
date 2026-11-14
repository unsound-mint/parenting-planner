import { cn } from "@/lib/utils";

type Tone = "plain" | "sun" | "leaf" | "me" | "them";

const tones: Record<Tone, string> = {
  // Most cards: warm white on paper with a hairline.
  plain: "border border-line bg-card",
  // The one hero or composer per screen.
  sun: "bg-sun",
  // Quizzes, done states, privacy notes.
  leaf: "bg-leaf-soft",
  // Something for the acting parent, in their accent.
  me: "bg-me-soft",
  // The other parent's side: their nudge, a talk prompt for both.
  them: "bg-them-soft",
};

type CardTag = "div" | "section" | "article" | "li" | "aside";

/**
 * The card surface. Tone picks the wash; padding and radius follow the comp
 * (28 px radius, 28 px padding, 22 px on phones). `hero` is the bigger radius
 * and padding for the one hero or composer per screen. Cards never nest:
 * inside a card, group with spacing or a soft inner row (bg-muted, rounded-2xl).
 */
export function SoftCard({
  tone = "plain",
  hero = false,
  as: Tag = "div",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone?: Tone; hero?: boolean; as?: CardTag }) {
  return (
    <Tag
      className={cn(
        "relative min-w-0 overflow-hidden",
        hero ? "rounded-[1.75rem] p-5.5 md:rounded-[2.25rem] md:p-10" : "rounded-3xl p-5.5 md:rounded-[1.75rem] md:p-7",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
