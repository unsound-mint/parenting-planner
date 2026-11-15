# Design

Owner: Denis. How the product looks, moves and feels. Read this before building or changing any screen in `web/`. The reference is the journey comp Denis approved on Nov 14; this file is its written form. The four earlier directions are in [design/directions.html](design/directions.html), for history only.

## What changed and why

The first version looked like a task tracker. Denis, on Nov 14: "we want people to be better parents but you build it like it's a task tracker. you added no moments of delight ... parents may want to know what size is their baby (like an apple) ... structure the learning paths so that parents have something to read, to dream about with each other ... both parents are involved ... using the journal should be easy and fast, and there should not be empty screens ... components should invite to use it, not just allow it ... hierarchy should be clean ... no need for maximalism ... playful, maybe even baby-like themes, visuals, animations could work great."

So the product is now a joyful journey for both parents, not a list of due items:

- Each screen opens with one hero: the baby (size this week, what they can do now), a learning path, or the journal composer. Practical items sit in a small calm list lower down, never first.
- Warm paper, Fraunces headings, illustrations with one shared face, a baby that bobs and wiggles.
- Each parent has an accent. Switching the acting parent swaps it across the whole screen.
- Every component invites use: starter chips, a suggested topic, a prompt to talk about tonight.

## Rules

1. One hero per screen, at most two rows under it. The hero is the baby, the path or the composer, not a status sentence.
2. No empty screens. Never "Nothing yet": show a starter (chips, a suggested first entry, a sample the user can take over) or a preview mock.
3. Cards speak in our own words and never cite: no source links, "Sources" chips or "According to the CDC" lead-ins. Every source and its checked date is listed once on the public `/sources` page ("How we check health guidance"), linked from `SiteFooter` at the end of every page. The AI never diagnoses.
4. Status colours: on track (leaf), upcoming (slate), due (ochre), overdue (clay). Overdue is never red. Red (`urgent`) is only for urgent symptoms and the crisis path.
5. Urgent help sits in the frame of every family screen. It opens a fixed screen with hotlines, never generated text, and never animates (no press, no transition, never inside `Rise`).
6. Two parents, two accents. `me` is the acting person, `them` the other parent; each person also keeps a fixed colour (`mom`, `partner`, caregivers neutral) for avatars and ownership.
7. Sources, dates and values are set in mono.
8. Privacy is visible: diary and mood are private to their author unless shared per entry, and a screen says who can see a thing next to it (a lock chip, a leaf privacy note). Caregivers never see diary, mood, labs or session notes.
9. No gamification: no streaks, points, scores or badges. Quizzes compare answers between parents, they do not grade.

Avoid: pink and baby blue, mom-only cues, purple gradients, cards inside cards, exclamation marks, maximalism.

## Hierarchy and visuals

A tired parent should understand a screen before reading a word. Show, then label.

Type scale. Use only these utilities, defined in `globals.css`:

| Utility | Size / line | Font | Use |
| --- | --- | --- | --- |
| `text-display` | 36 to 58 (fluid) / 1.04 | Fraunces, SOFT 100, WONK 1 | The hero line ("About the size of *a zucchini*"). One per screen. |
| `text-headline` | 24 to 28 (fluid) / 1.2 | Fraunces, SOFT 100 | Page title or section heading ("Read together this week"). |
| `text-title` | 19 / 24 | Fraunces, SOFT 100 | Card, lesson and entry titles. |
| `text-body` | 16 / 24 | Figtree | Running text. |
| `text-label` | 14 / 20 | Figtree 500 | Controls, chips, list secondary lines. |
| `text-caption` | 12 / 16 | Figtree | Timestamps, axis ticks; with `font-mono` for values. |

The `cn` helper in `lib/utils.ts` knows these as font sizes; add any new level there too.

1. Three reads per screen: the hero, the one thing to do next, then everything else. If two things compete for first read, shrink one.
2. A card uses at most three levels. Change weight and colour before size; muted text is for secondary lines only.
3. One uppercase eyebrow per card at most ("TALK ABOUT IT TONIGHT").
4. Spacing is on a 4 px grid. Related items sit 8 to 12 apart, groups 24 or more apart.
5. Every number that matters is drawn: progress as dots or a bar per parent, growth as an arc, a count as a figure.
6. Every category, stage, status and action has a lucide icon (maps in `web/src/lib/visuals.ts`). Illustrations are flat SVG in the comp's style, with one shared face.
7. Choices are pictures when they can be: `MoodFace` for mood, avatars for who, a lock for who can see.
8. Each fact once per screen. Explain an item in place (expand under it), not in a side panel that repeats it.
9. Before calling a screen done, screenshot it at 390, 1440 and 1920 px and look. Squint test: blurred, the three reads still stand out in order.

## Layout

Family screens use the width of the screen they are on. The parts live in `web/src/components/shell/page.tsx`.

1. The frame: a 248 px side nav with five sections (This week, Plan, Learn, Health, Family; then Privacy and Settings), a top bar (parent switch, stage label, demo controls, Urgent help) and the page. Every page belongs to one section, and the section's pages share a tab row under the top bar (`SectionTabs`). Sections and tabs are one list in `web/src/lib/sections.ts`; URLs do not follow them, so a page moves between sections by editing that list. On phones the nav is a floating bottom tab bar (the five sections and More), and the column leaves room under it.
2. The family layout caps the header and the page together at `max-w-page` (1600 px of content plus padding). A page never sets its own `max-w` on its wrapper.
3. Every page renders `PageFrame` as its `<main>`. Independent cards go in a `PageGrid`: one column on phones, two from `@4xl`, three from `@7xl` with `cols={3}`. These are container queries on the family column, not viewport breakpoints. Use the width to put related things side by side, not to stretch one card.
4. DOM order is the phone order. Columns come from grouping, spans and grid placement, never from reordering.
5. Running text stays at a reading measure (`max-w-prose`). A single-task flow (a quiz question, a questionnaire) keeps a reading measure instead of the grid.

## Tokens

All tokens live in `web/src/app/globals.css`; use them through Tailwind. Never hard-code a colour in a component; illustration SVGs (faces, fruit, covers) are the exception and keep their art colours inside the SVG.

| Token | Value | Use |
| --- | --- | --- |
| `paper` (`background`) | #FBF7F0 | Page |
| `card` | #FFFDF9 | Cards |
| `line` (`border`), `line-2` (`input`) | #EDE3D3, #E3D6C2 | Hairlines, dashed starters |
| `ink` (`foreground`), `ink-2`, `muted-foreground` | #2B2620, #4A423A, #6B6157 | Text |
| `muted` | #F3ECE1 | Soft fills, hover, inner rows |
| `sun`, `sun-2` | #FCEBD5, #F8DDB8 | Hero and composer wash |
| `butter` | #F4CD6A | Sun, blossom, a small sparkle; never text |
| `leaf`, `leaf-soft` | #3F6B37, #E6EFDC | Done, quiz, privacy note, development line |
| `mom`, `mom-soft`, `mom-mid` | #A04828, #FAE3D5, #E8A07C | Mother (terracotta) |
| `partner`, `partner-soft`, `partner-mid` | #1D6A70, #D8EDEB, #7DBAB6 | Partner (deep teal) |
| `grandparent`, `nanny` (and `-soft`) | #6E6253, #556270 | Caregivers, neutral |
| `me`, `them` (and `-soft`, `-mid`) | the acting person, the other parent | Accent. `primary`, `secondary`, `accent` and `ring` follow `me`. |
| `urgent` | #B3261E | Urgent help and the crisis path only |

The family layout sets `data-acting="<role>"` on its frame, and a `:root:has([data-acting=...])` rule swaps `me` and `them`, so popovers and toasts take the accent too. Outside the family area the accent is the mother's. Text pairs were computed at WCAG AA or better (muted on paper 5.7, mom on mom-soft 4.9, partner on partner-soft 5.2, leaf on leaf-soft 5.3). There is no dark theme for now.

Fonts, loaded with `next/font` in `app/layout.tsx`: Fraunces (variable, with the SOFT, WONK and opsz axes) for display, headline and title; Figtree for UI and body; JetBrains Mono for values.

## Motion

Motion is a core feature: it makes the app feel alive and answers every tap. It is also calm: things respond at once and settle softly.

The vocabulary, shared by CSS (`globals.css`) and Motion (`components/joy/motion.ts`):

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out`, `ease.out` | cubic-bezier(0.23, 1, 0.32, 1) | Default: entering, responding to a tap |
| `--ease-in-out`, `ease.inOut` | cubic-bezier(0.77, 0, 0.175, 1) | Something on screen moving or morphing |
| `--ease-drawer`, `ease.drawer` | cubic-bezier(0.32, 0.72, 0, 1) | Sheets and drawers |
| `--duration-press` | 120 ms | Press feedback |
| `--duration-fast`, `-base`, `-slow` | 150, 220, 320 ms | Hovers, most UI, panels |
| `--duration-enter` | 400 ms | Page entrance |
| `--stagger`, `stagger` | 70 ms | Between siblings entering |
| `spring.ui` | spring, bounce 0, 0.32 s | Morphs, layout, a card settling into done |
| `spring.gentle` | spring, bounce 0, 0.45 s | A bigger move, like a topic landing in the agenda |
| `spring.playful` | spring, bounce 0.3, 0.6 s | Only the baby, mascots and small celebrations |

Utilities: `press` (scale 0.97 while pressed, on every tappable thing), `lift` (3 px hover lift with a soft shadow, pointer devices only), and `rise` through `<Rise i={n}>` (staggered entrance). The baby and mascots bob, blink, beat and wiggle on tap inside `components/illustrations/` (`SizeIllustration`, `StageMascot`); reuse them rather than writing new loops.

1. Every screen enters with a 70 ms stagger: wrap its sections in `Rise`, numbered in reading order.
2. Every tap answers: `press` on buttons, chips and cards that open something. Mood faces tilt on hover and grow when picked.
3. State changes morph instead of jumping: saving a journal line, "we talked about it", marking a lesson read, answering a quiz. Use `spring.ui` with Motion `layout`, or a CSS transition.
4. Small celebrations at real milestones only (a lesson finished, both parents answered): `spring.playful`, once.
5. UI eases out and never bounces. Only the baby and mascots bob, wiggle and beat.
6. Animate only `transform` and `opacity`. UI durations stay between 150 and 400 ms. Use transitions, not keyframes, for anything a user can trigger twice in a second.
7. Reduced motion: `MotionConfig reducedMotion="user"` covers Motion; `globals.css` drops `rise` and the press scale, `illustrations.css` stops the baby's loops, and shortens every other transition. Do not opt out.
8. Never animate Urgent help, the crisis and urgent-symptom screens, error states, or anything on a keyboard shortcut.
9. Verify motion live: record a short Playwright video or frame sequence of the key interactions and look at it, once with reduced motion on.

Plain hovers and fades are CSS transitions; reach for Motion only for springs, layout or exit animation. Switching parent or family crossfades with a React view transition.

## Components

Shared building blocks for the joyful screens live in `web/src/components/joy/`:

| Component | What it is |
| --- | --- |
| `Rise` | Staggered entrance wrapper; `i` is the position in reading order. Server-safe, CSS only. |
| `SoftCard` | The card surface: `tone` plain, sun, leaf, me or them; `hero` for the one hero or composer. |
| `MoodFace`, `MoodPicker` | One blob, five faces and colours (mood 1 to 5, as in the API). The picker is controlled. |
| `SiteFooter` | The quiet last line: how we check health guidance, Privacy (inside a family), not medical advice. |
| `PartnerChip`, `Avatar` | A person's initial in their colour, alone or with a short note ("Jake saved it for you"). |
| `motion.ts` | `ease`, `duration`, `stagger`, `spring` and `tap` for Motion components. |

Two family-circle surfaces build on them. `components/share/` holds the share card: the PNG comes from the `week-card` route handler (`/family/<id>/week-card`, private and never cached, fonts in `web/assets/share-card`), and `ShareWeekButton` opens it in a dialog with the Web Share API and a download fallback. `components/postcard/` holds the grandparent postcard: `PostcardCard` (flip-in, Send love with a heart burst), `PostcardStudio` for the parents' weekly line, and `LoveInboxSlot` and `PostcardSlot` for This week.

The frame is in `components/shell/`: `family-nav.tsx` holds the side nav and the phone tab bar.

## Libraries

| Need | Use |
| --- | --- |
| Components (dialog, sheet, tabs, select, popover, tooltip) | shadcn/ui on Base UI: `pnpm dlx shadcn@latest add <name>` in `web/`. The code lands in `src/components/ui` and is ours to restyle. |
| Springs, layout and enter/exit animation | Motion (`motion/react`) with the tokens in `components/joy/motion.ts` |
| Route changes, parent and family switches | React `<ViewTransition>`, see `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` |
| Animated numbers | NumberFlow (`@number-flow/react`) |
| Confirmations ("Shared only with Dr. Reyes") | Sonner `toast()`; the `Toaster` is in `src/components/providers.tsx` |
| Icons | lucide-react |

## Agent skills for design work

Vendored in `.claude/skills/`: `impeccable` (critique, audit, polish, animate, delight; it reads `docs/product.md` and this file) and `vercel-react-view-transitions`. Before writing motion, load the `animate` skill (and `choreograph` for groups) if you have it. After building a screen, run `/impeccable critique <screen>` and fix what it ranks highest.
