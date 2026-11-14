import { Suspense } from "react";
import { Database } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import type { WeeklyPlan, WeeklyPlanPoint } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { weeklyNoteIcon } from "@/lib/visuals";

// The written weekly note for one parent, shown above the rule plan. It is an
// extra: while the endpoint is missing or failing, or when it only echoes the
// rule plan (fallback), nothing renders and This week looks as it always did.
export function AiPlan({ memberId }: { memberId: string }) {
  // Null fallback on purpose: a skeleton would flash and vanish on failure.
  return (
    <Suspense fallback={null}>
      <AiPlanLoader memberId={memberId} />
    </Suspense>
  );
}

async function AiPlanLoader({ memberId }: { memberId: string }) {
  let plan: WeeklyPlan | undefined;
  try {
    const api = await serverApi();
    const { data } = await api.GET("/members/{memberId}/weekly-plan", { params: { path: { memberId } } });
    plan = data;
  } catch {
    return null;
  }
  return <AiPlanNote plan={plan} />;
}

export function AiPlanNote({ plan }: { plan?: WeeklyPlan }) {
  const sections = plan?.sections.filter((s) => s.points.length > 0) ?? [];
  if (!plan || plan.fallback || sections.length === 0) return null;
  const Icon = weeklyNoteIcon;

  return (
    <section aria-labelledby="ai-plan-title" className="mt-8 max-w-2xl rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <h2 id="ai-plan-title" className="flex-1 text-title">
          A note for your week
        </h2>
        <time dateTime={plan.generatedAt} className="font-mono text-caption text-muted-foreground">
          {formatLongDate(plan.generatedAt.slice(0, 10))}
        </time>
      </div>

      <p className="mt-4 text-body text-balance">{plan.intro}</p>

      <div className="mt-6 flex flex-col gap-6">
        {sections.map((section, si) => (
          <div key={section.title}>
            <h3 className="text-label font-medium text-muted-foreground">{section.title}</h3>
            <ol className="mt-3 flex flex-col gap-4">
              {section.points.map((point, pi) => (
                <Point key={`${si}-${pi}`} point={point} focus={si === 0 && pi === 0} />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function Point({ point, focus }: { point: WeeklyPlanPoint; focus: boolean }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0">
        <p className={focus ? "text-title" : "text-body"}>{point.text}</p>
        <p className="mt-1 flex items-start gap-1.5 text-label font-normal text-muted-foreground">
          <Database className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{point.reason}</span>
        </p>
        {point.source && (
          <a
            href={point.source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block font-mono text-caption text-muted-foreground underline-offset-2 hover:underline"
          >
            {point.source.title} · checked {formatLongDate(point.source.checkedAt)}
          </a>
        )}
      </div>
    </li>
  );
}
