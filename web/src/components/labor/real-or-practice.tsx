import { Activity, Armchair, TrendingUp } from "lucide-react";
import { LABOR_SOURCES } from "@/lib/labor";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";

// Practice (Braxton Hicks) or labor: what the cited pages say tells them apart,
// as three pictures side by side. Explains, never decides: the timer and the
// family's own care team do that.

const ROWS = [
  { icon: Activity, what: "Rhythm", practice: "Irregular, they come and go", labor: "Regular, closer together over time" },
  { icon: TrendingUp, what: "Strength", practice: "Weak, short, they don't build", labor: "Stronger and longer each time" },
  { icon: Armchair, what: "Rest or move", practice: "Often stop when you change position", labor: "Keep coming whatever you do" },
] as const;

/** Dots on a line: practice tightenings scattered and even, labor ones closing in and growing. */
function Pattern({ kind }: { kind: "practice" | "labor" }) {
  const dots =
    kind === "practice"
      ? [
          [8, 4],
          [22, 5],
          [52, 4],
          [64, 5],
          [88, 4],
        ]
      : [
          [8, 3.5],
          [34, 4.5],
          [56, 5.5],
          [74, 6.5],
          [88, 7.5],
        ];
  return (
    <svg viewBox="0 0 96 20" className="h-6 w-full" aria-hidden>
      <line x1="2" x2="94" y1="10" y2="10" className="stroke-line-2" strokeWidth="1.5" strokeLinecap="round" />
      {dots.map(([x, r]) => (
        <circle key={x} cx={x} cy="10" r={r} className={kind === "labor" ? "fill-me" : "fill-muted-foreground/45"} />
      ))}
    </svg>
  );
}

export function RealOrPractice() {
  return (
    <SoftCard as="section" aria-labelledby="real-title" className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-caption tracking-wide text-muted-foreground uppercase">Real or practice</p>
        <h2 id="real-title" className="mt-1 text-title">
          How labor contractions feel different
        </h2>
      </div>

      <div className="grid grid-cols-[auto_1fr_1fr] items-start gap-x-3 gap-y-4">
        <span />
        <div className="flex flex-col gap-1">
          <Pattern kind="practice" />
          <span className="text-label font-semibold text-muted-foreground">Practice</span>
        </div>
        <div className="flex flex-col gap-1">
          <Pattern kind="labor" />
          <span className="text-label font-semibold text-me">Labor</span>
        </div>
        {ROWS.map(({ icon: Icon, what, practice, labor }) => (
          <div key={what} className="contents">
            <span className="grid size-9 place-items-center rounded-full bg-muted text-ink-2" title={what}>
              <Icon className="size-4" aria-hidden />
              <span className="sr-only">{what}</span>
            </span>
            <p className="text-label font-normal text-ink-2">{practice}</p>
            <p className="text-label font-normal">{labor}</p>
          </div>
        ))}
      </div>

      <p className="text-label font-normal text-ink-2">
        Other signs of labor: a pink or slightly bloody discharge (the show), a dull low backache, period-like cramps, or a gush or trickle of fluid when the waters break.
      </p>
      <p className="rounded-2xl bg-muted/70 p-4 text-label">
        You don&apos;t have to be sure. Time a few with the timer, and if you are unsure or worried, call. Your care team&apos;s instructions come first.
      </p>
      <SourceLine sources={[LABOR_SOURCES.nichdStart, LABOR_SOURCES.nhsSigns]} />
    </SoftCard>
  );
}
