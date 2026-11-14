import { cn } from "@/lib/utils";

type RiseTag = "div" | "section" | "article" | "li" | "aside" | "header";

/**
 * Staggered page entrance: the element rises 8 px and fades in over 400 ms,
 * starting i × 70 ms after the page renders. Number a screen's sections in
 * reading order (hero 0, first row 1, ...) and stop around 6: later sections are
 * below the fold anyway. Pure CSS (the `rise` utility in globals.css), so it works
 * in server components and runs on the compositor while the page is busy.
 * Off under reduced motion. Never wrap Urgent help or an urgent screen in it.
 */
export function Rise({ i = 0, as: Tag = "div", className, style, ...props }: React.HTMLAttributes<HTMLElement> & { i?: number; as?: RiseTag }) {
  return <Tag className={cn("rise", className)} style={{ "--i": i, ...style } as React.CSSProperties} {...props} />;
}
