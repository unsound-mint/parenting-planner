import { Suspense } from "react";
import { notFound } from "next/navigation";
import { inLossSupport } from "@/lib/loss";
import { Baby } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import type { SimulatorScenario } from "@/lib/api/types";
import { shiftTimes } from "@/lib/schedule";
import { skillIcon, skillLabel } from "@/lib/visuals";
import { SkillBars } from "@/components/simulator/skill-bars";
import { StartRoundButton } from "@/components/simulator/start-round-button";

// Practice: short scenarios that train one skill each. Scores are the
// person's own; the round ends with a shift they can commit to.
export default function SimulatorPage({ params }: PageProps<"/family/[memberId]/simulator">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Simulator params={params} />
    </Suspense>
  );
}

async function Simulator({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const [{ data: progress, response }, { data: family }] = await Promise.all([
    api.GET("/members/{memberId}/simulator", { params: { path: { memberId } } }),
    api.GET("/family"),
  ]);
  if (!progress || response.status === 501 || response.status === 404) notFound();
  // The nav hides it in pregnancy loss support (layout.tsx); a direct visit gets the same.
  if (family && inLossSupport(family)) notFound();

  const weak = progress.weakSpots;
  const headline =
    progress.roundsCompleted === 0
      ? "Try one scenario. It takes about two minutes."
      : weak.length > 0
        ? `${skillLabel[weak[0]]} needs another look. Practice it now.`
        : "No weak spots. Keep it fresh with a practice round.";

  return (
    <main className="grid flex-1 gap-8 px-4 pt-6 pb-16 md:px-8 xl:grid-cols-[minmax(0,44rem)_minmax(0,22rem)] xl:justify-start">
      <section aria-labelledby="sim-headline" className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 id="sim-headline" className="max-w-2xl text-headline text-balance">
            {headline}
          </h1>
          <p className="mt-2 text-label font-normal text-muted-foreground">Only you see your scores</p>
        </div>

        {progress.roundsCompleted > 0 && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/30 bg-secondary p-5">
            <div className="min-w-0 flex-1">
              <p className="text-title text-secondary-foreground">Practice round</p>
              <p className="text-label font-normal text-secondary-foreground/80">
                Up to 8 questions, starting with the ones you missed.
              </p>
            </div>
            <StartRoundButton memberId={memberId} mode="practice" label="Practice now" />
          </div>
        )}

        <section aria-labelledby="scenarios-title" className="flex flex-col gap-3">
          <h2 id="scenarios-title" className="text-title">
            Scenarios
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {progress.scenarios.map((s) => (
              <li key={s.id}>
                <ScenarioCard scenario={s} memberId={memberId} />
              </li>
            ))}
          </ul>
        </section>
      </section>

      <aside className="xl:pt-1">
        <section aria-labelledby="skills-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="skills-title" className="text-title">
            Your skills
          </h2>
          <div className="mt-4">
            <SkillBars skills={progress.skills} />
          </div>
        </section>
      </aside>
    </main>
  );
}

function ScenarioCard({ scenario, memberId }: { scenario: SimulatorScenario; memberId: string }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {scenario.skills.map((k) => {
          const Icon = skillIcon[k];
          return (
            <span key={k} title={skillLabel[k]} className="flex size-8 items-center justify-center rounded-full bg-muted">
              <Icon className="size-4" aria-hidden />
              <span className="sr-only">{skillLabel[k]}</span>
            </span>
          );
        })}
        <span className="ml-auto font-mono text-caption">{scenario.questionCount} questions</span>
      </div>
      <div className="flex-1">
        <h3 className="text-title">{scenario.title}</h3>
        <p className="mt-1 text-label font-normal text-muted-foreground">{scenario.summary}</p>
      </div>
      {scenario.suggestedShift && (
        <p className="flex items-center gap-2 text-caption text-muted-foreground">
          <Baby className="size-3.5 shrink-0" aria-hidden />
          Ends with a shift to commit to: {scenario.suggestedShift.title}, {shiftTimes(scenario.suggestedShift)}
        </p>
      )}
      <div>
        <StartRoundButton memberId={memberId} mode="scenario" scenarioId={scenario.id} label="Play" variant="secondary" />
      </div>
    </article>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
      </div>
    </main>
  );
}
