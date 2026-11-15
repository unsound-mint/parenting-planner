import Link from "next/link";
import { ArrowRight, Baby } from "lucide-react";
import type { SimulatorProgress } from "@/lib/api/types";
import { shiftTimes } from "@/lib/schedule";
import { skillIcon, skillLabel } from "@/lib/visuals";
import { SoftCard } from "@/components/joy/soft-card";
import { StartRoundButton } from "./start-round-button";

/**
 * Practice inside Learn: the simulator's scenarios as hands-on rehearsal
 * ("Practice the first night home"). Only invitations here; scores stay on the
 * simulator page, private to each parent, and never become points on Learn.
 */
export function PracticeSection({ progress, memberId, lead }: { progress: SimulatorProgress; memberId: string; /** A full-width card above the rounds (Virtual Baby on Learn). */ lead?: React.ReactNode }) {
  const n = progress.scenarios.length;
  if (n === 0) return lead ?? null;
  // Rows fill: four as 2x2 then four across, three or six in threes, so no card sits alone in a row.
  const cols = n === 1 ? "" : n === 2 ? "@3xl:grid-cols-2" : n === 3 ? "@3xl:grid-cols-3" : n % 4 === 0 ? "@3xl:grid-cols-2 @7xl:grid-cols-4" : "@3xl:grid-cols-2 @7xl:grid-cols-3";
  return (
    <section aria-labelledby="practice-title" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="practice-title" className="text-headline">
            Practice before it is real
          </h2>
          <p className="mt-1 text-label font-normal text-muted-foreground">Two-minute rounds, one tricky moment each. Only you see how you did.</p>
        </div>
        {progress.roundsCompleted > 0 && (
          <Link href={`/family/${memberId}/simulator`} className="inline-flex min-h-11 items-center gap-1.5 text-label text-ink-2 underline decoration-line-2 underline-offset-3 hover:text-ink">
            Your practice so far
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {lead}
      <ul className={`grid gap-4 ${cols}`}>
        {progress.scenarios.map((s) => (
          <li key={s.id} className="min-w-0">
            <SoftCard className="flex h-full flex-col gap-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {s.skills.map((k) => {
                  const Icon = skillIcon[k];
                  return (
                    <span key={k} title={skillLabel[k]} className="flex size-9 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-4.5" aria-hidden />
                      <span className="sr-only">{skillLabel[k]}</span>
                    </span>
                  );
                })}
                <span className="ml-auto font-mono text-caption">{s.questionCount} questions</span>
              </div>
              <div className="flex-1">
                <h3 className="text-title">{s.title}</h3>
                <p className="mt-1 text-label font-normal text-muted-foreground">{s.summary}</p>
              </div>
              {s.suggestedShift && (
                <p className="flex items-center gap-2 text-caption text-muted-foreground">
                  <Baby className="size-3.5 shrink-0" aria-hidden />
                  Ends with a shift to try: {s.suggestedShift.title}, {shiftTimes(s.suggestedShift)}
                </p>
              )}
              <div>
                <StartRoundButton memberId={memberId} mode="scenario" scenarioId={s.id} label="Practice it" variant="secondary" />
              </div>
            </SoftCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
