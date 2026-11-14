import { Suspense } from "react";
import Link from "next/link";
import { Database, Lock } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import type { Tier, WeeklyPlan, WeeklyPlanPoint } from "@/lib/api/types";
import { PAYWALL_LOCKS } from "@/lib/features";
import { formatLongDate } from "@/lib/format";
import { weeklyNoteIcon } from "@/lib/visuals";

// The written weekly note for one parent, shown above the rule plan. It is an
// extra: while the endpoint is missing or failing, or when it only echoes the
// rule plan (fallback), nothing renders and This week looks as it always did.
export function AiPlan({ memberId, tier }: { memberId: string; tier?: Tier }) {
  // Null fallback on purpose: a skeleton would flash and vanish on failure.
  return (
    <Suspense fallback={null}>
      <AiPlanLoader memberId={memberId} tier={tier} />
    </Suspense>
  );
}

async function AiPlanLoader({ memberId, tier }: { memberId: string; tier?: Tier }) {
  let plan: WeeklyPlan | undefined;
  try {
    const api = await serverApi();
    const { data } = await api.GET("/members/{memberId}/weekly-plan", { params: { path: { memberId } } });
    plan = data;
  } catch {
    return null;
  }
  // Free plan: show the lock only when there is a real note to unlock.
  if (PAYWALL_LOCKS && tier === "free" && hasNote(plan)) return <LockedNote />;
  return <AiPlanNote plan={plan} />;
}

function hasNote(plan?: WeeklyPlan) {
  return !!plan && !plan.fallback && plan.sections.some((s) => s.points.length > 0);
}

// Plus feature: a small lock that leads to the pricing page.
function LockedNote() {
  const Icon = weeklyNoteIcon;
  return (
    <Link
      href="/pricing"
      className="mt-8 flex min-h-14 max-w-2xl items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-5 py-3 transition-colors duration-150 hover:bg-muted"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="flex-1 text-title">A note for your week</span>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-3 text-caption font-medium text-secondary-foreground">
        <Lock className="size-3.5" aria-hidden />
        Plus
      </span>
    </Link>
  );
}

export function AiPlanNote({ plan }: { plan?: WeeklyPlan }) {
  if (!plan || !hasNote(plan)) return null;
  const sections = plan.sections.filter((s) => s.points.length > 0);
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
