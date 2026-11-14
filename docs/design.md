# Design

Owner: Denis. How the product looks, moves and feels. Read this before building or changing any screen in `web/`. The four directions we compared, with mocks, are in [design/directions.html](design/directions.html) (open it in a browser).

## Feeling

The product exists to lower the anxiety and mental load of busy parents who care a lot. Every screen should leave them calmer than it found them, and leave room for the good part: they are waiting to meet their child.

What parents feel and what the screen does about it:

| They feel | The screen |
| --- | --- |
| Fear of missing something | Opens with a status sentence ("You are on track. Two things need you this week."), gives every item a window, keeps done items visible. |
| Information overload | One short plan for the week. Sources sit behind each item, one click away. |
| "Is this normal?" | Plain, kind words that name the data behind each point. A clear line between normal, worth asking about, and urgent. |
| Unseen, or left out (partners) | Content visibly built from their data. Each parent has their own screen and accent. |
| Exhausted | Soft colors that still pass WCAG AA, big targets, no red unless it is an emergency. Night mode is the `.dark` theme. |
| Panic in a real emergency | A fixed help entry in every screen's frame that looks unlike anything else. |

## Direction

Base: direction A, "Steady". A calm dashboard on warm paper: navigation on the left, the plan in the middle, "why this is in your plan" (trigger data, guideline, source, checked date) on the right. Desktop first because judges use laptops; it must still work on a phone.

Borrowed from C, "Bloom": one highlighted "today" card above the plan, and a soft generated shape per journey stage so switching families looks different at a glance.

Borrowed from B, "Letter": the voice of the AI plan. It reads like a short note from someone who knows the family, not a feed. This is a prompt and copy rule more than a visual one.

From D, "Night light": the `.dark` token set.

Avoid: pink and baby blue, mom-only cues, purple gradients, cards inside cards, a rounded icon tile above every heading, exclamation marks, gamification (streaks, points, badges).

## Rules

1. Reassurance first. The first line on the home screen is a status sentence, not a list.
2. One focus. One highlighted next step; everything else is visible but quieter.
3. Every plan item says why: the data that triggered it, the guideline, the source and the date it was checked.
4. Status colors: on track (sage), upcoming (slate), due (ochre), overdue (clay). Overdue is never red. Red (`urgent`) is only for urgent symptoms and the crisis path.
5. The help entry ("Urgent help") is in the frame of every family screen. It opens a fixed screen with hotlines, never generated text, and is never animated.
6. Two parents, two accents: `mom` and `partner`. Use them for ownership in the shared plan and the shift handoff, not as decoration.
7. Sources, dates and lab values are set in mono.

## Tokens

All tokens live in `web/src/app/globals.css`; use them through Tailwind (`bg-card`, `text-muted-foreground`, `text-status-due bg-status-due-soft`, `text-partner`). Never hard-code a color in a component. Fonts: Inter for everything, JetBrains Mono for sources and values.

## Motion and delight

Calm comes partly from motion: things respond at once, settle softly and never bounce for attention.

- Durations: 150 ms for presses and hovers, about 220 ms for most UI, 320 ms at most for panels and page changes. Ease out (`--ease-out`), never ease in. Motion defaults to a spring with no bounce.
- Respect reduced motion. `MotionConfig reducedMotion="user"` and a CSS rule in `globals.css` cover it; do not opt out.
- Animate only `transform` and `opacity`.
- Never animate: the crisis and urgent-symptom screens, overdue items, error states, or anything on a keyboard shortcut.

Where delight goes, quietly:

- Anticipation: "about 16 weeks until you meet your baby". The number rolls over with NumberFlow when the week changes, and the stage shape shifts slightly.
- Completion: checking off a plan item gives a soft spring, the item settles into "done" (Motion layout animation), and a clear week gets one calm moment.
- Milestones for children ("first social smile is usually around now") appear as a small card, not a notification.
- A refreshed AI plan streams in instead of showing a spinner.
- Switching parent or family crossfades with a React view transition.

## Libraries

| Need | Use |
| --- | --- |
| Components (dialog, sheet, tabs, select, popover, tooltip) | shadcn/ui on Base UI: `pnpm dlx shadcn@latest add <name>` in `web/`. The code lands in `src/components/ui` and is ours to restyle. |
| Springs, layout and enter/exit animation | Motion (`motion/react`) |
| Route changes, parent and family switches | React `<ViewTransition>`, see `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` |
| Animated numbers | NumberFlow (`@number-flow/react`) |
| Confirmations ("Shared only with Dr. Reyes") | Sonner `toast()`; the `Toaster` is in `src/components/providers.tsx` |
| Charts | shadcn chart (recharts), added when the first chart lands |
| Icons | lucide-react |

Plain hovers and fades are CSS transitions; reach for Motion only for springs, layout or exit animation.

## Agent skills for design work

Vendored in `.claude/skills/`: `impeccable` (critique, audit, polish, animate, delight; it reads `docs/product.md` and this file) and `vercel-react-view-transitions`. After building a screen, run `/impeccable critique <screen>` and fix what it ranks highest.
