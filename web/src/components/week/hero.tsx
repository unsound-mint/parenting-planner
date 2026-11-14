import { Sparkles } from "lucide-react";
import type { Family, PregnancyWeek, StageNow } from "@/lib/api/types";
import { SizeIllustration, StageMascot } from "@/components/illustrations";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";
import { formatShortDate, stageLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ARC_H, ARC_W, GrowthArc, arcPoint } from "./growth-arc";
import { babyBubble, developmentTopic, lengthLabel, warmLine, weekFraction, weightLabel } from "./this-week";

// The one hero of This week. Every stage uses the same frame: words on the
// left, the baby or the stage mascot on the right (on top on phones), on the
// sun wash. Pregnancy shows the size this week on the growth arc; other stages
// show what is happening now (GET /now). Loss support has its own quiet hero.

const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

function Frame({ art, children, className }: { art?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <SoftCard tone="sun" hero className={cn("grid p-0 md:p-0 @4xl:min-h-[29rem] @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]", className)}>
      {/* A soft glow behind the art, like light through a window. */}
      <div aria-hidden className="pointer-events-none absolute -top-44 -right-36 size-[38rem] rounded-full bg-[radial-gradient(circle,#FFF6E6_0%,rgb(255_246_230/0)_70%)]" />
      {art && <div className="relative min-w-0 self-end @4xl:col-start-2 @4xl:row-start-1">{art}</div>}
      <div className="relative flex min-w-0 flex-col px-5.5 pb-6.5 @4xl:col-start-1 @4xl:row-start-1 @4xl:py-13 @4xl:pr-0 @4xl:pl-14">{children}</div>
    </SoftCard>
  );
}

function When({ pill, now }: { pill?: string; now: Date }) {
  return (
    <p className="flex flex-wrap items-center gap-3 text-label font-semibold text-ink-2">
      {pill && <span className="rounded-full bg-card px-3 py-1">{pill}</span>}
      <span>{dateFmt.format(now)}</span>
    </p>
  );
}

function Stat({ n, unit, label }: { n: string; unit: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-headline leading-none">
        {n}
        <span className="ml-1 font-sans text-label font-medium text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-1.5 max-w-[13ch] text-label font-normal text-muted-foreground @4xl:max-w-none">{label}</p>
    </div>
  );
}

export function PregnancyHero({
  family,
  week,
  card,
  ends,
  partnerName,
  now,
}: {
  family: Family;
  week: number;
  card?: PregnancyWeek;
  /** Size names at weeks 4 and 40, for the ends of the arc. */
  ends: [string | undefined, string | undefined];
  partnerName?: string;
  now: Date;
}) {
  const size = card?.size;
  const topic = developmentTopic(card?.development);
  const [x, y] = arcPoint(weekFraction(week));
  const toGo = Math.max(0, 40 - week);
  const name = (s?: string) => s?.replace(/^(a|an)\s+/i, "");

  const art = (
    <div className="relative mx-auto aspect-[760/470] w-full">
      <GrowthArc week={week} startLabel={`wk 4${ends[0] ? ` · ${name(ends[0])}` : ""}`} endLabel={`wk 40${ends[1] ? ` · ${name(ends[1])}` : ""}`} />
      {/* The baby sits on today's dot; its box is 300 x 260, so the bottom is the shadow. */}
      <div className="absolute w-[50%] -translate-x-1/2 @4xl:w-[40%]" style={{ left: `${(x / ARC_W) * 100}%`, bottom: `${((ARC_H - y) / ARC_H) * 100 - 1.5}%` }}>
        {size ? (
          <SizeIllustration comparison={size.comparison} week={week} bubble={babyBubble(topic)} seed={`week-${week}`} />
        ) : (
          <StageMascot stage="pregnancy" heart bubble={babyBubble("other")} label={`Week ${week} of pregnancy`} />
        )}
      </div>
    </div>
  );

  return (
    <Frame art={art}>
      <When pill={`Week ${week}`} now={now} />
      {size ? (
        <h1 className="mt-4.5 max-w-[13ch] text-display text-balance">
          About the size of <em className="block font-medium text-me">{size.comparison}</em>
        </h1>
      ) : (
        <h1 className="mt-4.5 max-w-[14ch] text-display text-balance">
          Week {week}, <em className="font-medium text-me">growing every day</em>
        </h1>
      )}
      <p className="mt-4.5 max-w-[40ch] text-body text-ink-2">{warmLine(topic, partnerName)}</p>
      {size && (
        <div className="mt-auto flex gap-x-5.5 pt-6 @4xl:gap-x-10 @4xl:pt-8">
          <Stat n={size.lengthCm.toFixed(1)} unit="cm" label={lengthLabel(size)} />
          {size.weightG != null && <Stat n={String(Math.round(size.weightG))} unit="g" label={weightLabel(size.weightG)} />}
          <Stat n={String(toGo)} unit={toGo === 1 ? "week" : "weeks"} label={family.dueDate ? `to go, due ${formatShortDate(family.dueDate)}` : "to go"} />
        </div>
      )}
      {card?.development && (
        <div className={cn("flex flex-wrap items-center gap-x-4.5 gap-y-2", size ? "mt-5" : "mt-auto pt-8")}>
          <p className="max-w-[60ch] rounded-2xl bg-leaf-soft px-3 py-1.5 text-label font-medium text-leaf">{card.development}</p>
          {size && <SourceLine sources={size.sources} />}
        </div>
      )}
    </Frame>
  );
}

export function StageHero({ family, now, stageNow }: { family: Family; now: Date; stageNow?: StageNow }) {
  const art = (
    <div className="relative mx-auto aspect-[760/470] w-full">
      <svg viewBox="0 0 760 470" className="absolute inset-0 size-full" aria-hidden focusable="false">
        <path d="M-20 470 C 120 360, 300 330, 430 360 S 700 420, 800 340 L 800 470 Z" className="fill-sun-2" opacity=".55" />
        <circle cx="610" cy="120" r="44" className="fill-butter" opacity=".8" />
      </svg>
      <div className="absolute bottom-[10%] left-1/2 w-[46%] -translate-x-1/2">
        <StageMascot stage={family.stage} heart bubble={family.children[0] ? `Hi. It's ${family.children[0].name}.` : "Hello, you two."} label={stageNow?.period} />
      </div>
    </div>
  );
  return (
    <Frame art={art}>
      <When pill={stageNow?.period ?? stageLabel[family.stage]} now={now} />
      <h1 className="mt-4.5 max-w-[16ch] text-display text-balance">{stageNow?.headline ?? defaultHeadline(family)}</h1>
      {stageNow && (
        <>
          <p className="mt-4.5 max-w-[48ch] text-body text-ink-2">{stageNow.detail}</p>
          <div className="mt-auto pt-8">
            <p className="flex max-w-[56ch] items-start gap-3 rounded-2xl bg-card/70 px-4 py-3 text-body">
              <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-me" />
              <span>
                <span className="mr-1.5 font-semibold text-me">Try today</span>
                {stageNow.playIdea}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-label font-normal text-muted-foreground">{stageNow.note}</p>
              <SourceLine sources={stageNow.sources} />
            </div>
          </div>
        </>
      )}
    </Frame>
  );
}

function defaultHeadline(family: Family) {
  const child = family.children[0];
  if (child) return `Here is ${child.name}'s week.`;
  if (family.stage === "planning" || family.stage === "trying") return "Getting ready together.";
  return "Here is your week.";
}

/** Pregnancy loss support: no baby, no size, no mascot. A calm line and room. */
export function LossHero({ name, now }: { name: string; now: Date }) {
  return (
    <SoftCard tone="sun" hero>
      <When now={now} />
      <h1 className="mt-4.5 max-w-[22ch] text-display text-balance">We are so sorry, {name}.</h1>
      <p className="mt-4.5 max-w-[48ch] text-body text-ink-2">Take the time you need. Anything you write here stays private to you.</p>
    </SoftCard>
  );
}

/**
 * A grandparent's or nanny's hero: the baby (its size when the week card is
 * readable for this role, otherwise the stage mascot) and a greeting. No
 * parent data: no notes, no plan, no partner lines.
 */
export function CaregiverHero({ family, name, card, context, now }: { family: Family; name: string; card?: PregnancyWeek; context: string; now: Date }) {
  const child = family.children[0];
  const size = card?.size;
  const art = (
    <div className="relative mx-auto aspect-[760/470] w-full">
      <svg viewBox="0 0 760 470" className="absolute inset-0 size-full" aria-hidden focusable="false">
        <path d="M-20 470 C 120 360, 300 330, 430 360 S 700 420, 800 340 L 800 470 Z" className="fill-sun-2" opacity=".55" />
        <circle cx="610" cy="120" r="44" className="fill-butter" opacity=".8" />
      </svg>
      <div className="absolute bottom-[10%] left-1/2 w-[46%] -translate-x-1/2">
        {size && card ? (
          <SizeIllustration comparison={size.comparison} week={card.week} heart label={`About the size of ${size.comparison}`} />
        ) : (
          <StageMascot stage={family.stage} heart label={stageLabel[family.stage]} />
        )}
      </div>
    </div>
  );
  const headline = family.stage === "pregnancy" ? "The baby is on the way." : child ? `Here is ${child.name}'s care.` : "Here is the family's week.";
  return (
    <Frame art={art}>
      <When pill={family.stage === "pregnancy" && family.gestationalWeek ? `Week ${family.gestationalWeek}` : stageLabel[family.stage]} now={now} />
      <h1 className="mt-4.5 max-w-[16ch] text-display text-balance">
        Hello, {name}.<em className="block font-medium text-me">{headline}</em>
      </h1>
      {size && <p className="mt-4.5 max-w-[48ch] text-body text-ink-2">About the size of {size.comparison} this week.</p>}
      <p className="mt-auto pt-8 text-label font-normal text-muted-foreground">{context}</p>
    </Frame>
  );
}
