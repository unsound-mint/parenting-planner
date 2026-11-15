import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Baby,
  Brain,
  CloudRain,
  FlaskConical,
  HeartHandshake,
  HeartPulse,
  MessageSquare,
  Phone,
  Siren,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import { BackLink, BackLinkFallback } from "@/components/help/back-link";
import { CareTeam } from "@/components/help/care-team";
import { PRODUCT_NAME } from "@/lib/product";

// Crisis and urgent-symptom screen. Rules, do not relax them:
// - Fixed text, the same for everyone. Never AI-generated. The hotlines and
//   warning signs are never read from the API or a cookie; only the care team
//   island below them reads the family's records, and it renders nothing when
//   that fails.
// - Never animated: no Motion, no CSS transitions (docs/design.md, "Motion and delight").
// - A full page, never a dialog, so no stray tap or Escape can close it.
// - Static server component, prerendered at build time. The service worker
//   (app/sw.js/route.ts) keeps a copy so it opens offline.
// - No source lines or dates on the page itself. Wording is owned by Dayana (#182).
//   Every number and claim below was read on 2026-11-14 on the CDC Hear Her page
//   (warning signs), 988lifeline.org, the HRSA hotline page and poison.org; re-check them before changing anything here.
//   The HRSA hotline page refuses automated readers, so the hotline's details
//   are checked on the PSI page that lists it.
// - Red (urgent) appears only in the 911 block, so the one action that matters
//   most is the first thing a scared parent sees.
export const metadata: Metadata = {
  title: "Help now",
};

type SignGroup = { id: string; icon: LucideIcon; title: string; signs: string[] };

// Each sign is the CDC wording verbatim; only the grouping and group titles are
// ours, so a parent can find their symptom by body area in seconds. All 15 CDC
// signs must stay listed.
const WARNING_SIGNS: SignGroup[] = [
  {
    id: "head",
    icon: Brain,
    title: "Head and vision",
    signs: ["Headache that won't go away or gets worse over time", "Dizziness or fainting", "Changes in your vision"],
  },
  {
    id: "breath",
    icon: HeartPulse,
    title: "Breathing and heart",
    signs: ["Trouble breathing", "Chest pain or fast-beating heart"],
  },
  {
    id: "belly",
    icon: Baby,
    title: "Belly, bleeding and baby's movements",
    signs: [
      "Severe belly pain that doesn't go away",
      "Baby's movement stopping or slowing during pregnancy",
      "Vaginal bleeding or fluid leaking during pregnancy",
      "Vaginal bleeding or discharge after pregnancy",
    ],
  },
  {
    id: "body",
    icon: Thermometer,
    title: "Fever, swelling and sickness",
    signs: [
      "Fever of 100.4°F or higher",
      "Extreme swelling of your hands or face",
      "Severe swelling, redness, or pain of your leg or arm",
      "Severe nausea and throwing up",
    ],
  },
  {
    id: "mind",
    icon: CloudRain,
    title: "Mood and energy",
    signs: ["Thoughts about harming yourself or your baby", "Overwhelming tiredness"],
  },
];

type Line = {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  note?: string;
  /** Shown on the buttons. */
  display: string;
  /** Digits for tel: and sms:. */
  dial: string;
  text: boolean;
};

const TALK_LINES: Line[] = [
  {
    id: "lifeline",
    icon: HeartHandshake,
    title: "Thoughts of harming yourself or your baby",
    body: "988 Suicide & Crisis Lifeline. Call or text 988, any time, day or night.",
    display: "988",
    dial: "988",
    text: true,
  },
  {
    id: "maternal",
    icon: MessageSquare,
    title: "National Maternal Mental Health Hotline",
    body: "1-833-TLC-MAMA. Call or text, 24/7, free and confidential, in English and Spanish.",
    note: "This is not an emergency line. If you are in danger, call 911.",
    display: "1-833-852-6262",
    dial: "18338526262",
    text: true,
  },
];

const POISON: Line = {
  id: "poison",
  icon: FlaskConical,
  title: "Poison Control",
  body: "Open 24/7, free and confidential.",
  note: "If the person collapses, has a seizure, has trouble breathing or can't be woken up, call 911 now.",
  display: "1-800-222-1222",
  dial: "18002221222",
  text: false,
};

const actionClass =
  "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-body font-semibold whitespace-nowrap text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function LineCard({ line }: { line: Line }) {
  const Icon = line.icon;
  return (
    <section aria-labelledby={line.id} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h3 id={line.id} className="text-title font-semibold">
            {line.title}
          </h3>
          <p className="text-body">{line.body}</p>
          {line.note && <p className="text-label text-muted-foreground">{line.note}</p>}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-3">
        <a href={`tel:${line.dial}`} className={actionClass}>
          <Phone aria-hidden className="size-4" />
          Call <span className="font-mono">{line.display}</span>
        </a>
        {line.text && (
          <a href={`sms:${line.dial}`} className={actionClass}>
            <MessageSquare aria-hidden className="size-4" />
            Text <span className="font-mono">{line.display}</span>
          </a>
        )}
      </div>
    </section>
  );
}

function PoisonRow({ line }: { line: Line }) {
  const Icon = line.icon;
  return (
    <section aria-labelledby={line.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex flex-1 items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-4" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id={line.id} className="text-body font-semibold">
            {line.title} <span className="font-normal text-muted-foreground">{line.body}</span>
          </h2>
          {line.note && <p className="text-label text-muted-foreground">{line.note}</p>}
        </div>
      </div>
      <a href={`tel:${line.dial}`} className={`${actionClass} sm:flex-none`}>
        <Phone aria-hidden className="size-4" />
        Call <span className="font-mono">{line.display}</span>
      </a>
    </section>
  );
}

function SignCard({ group }: { group: SignGroup }) {
  const Icon = group.icon;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h3 id={`signs-${group.id}`} className="flex items-center gap-3 text-title font-semibold">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5" />
        </span>
        {group.title}
      </h3>
      <ul aria-labelledby={`signs-${group.id}`} className="flex flex-col gap-2">
        {group.signs.map((sign) => (
          <li key={sign} className="flex items-start gap-3 text-body">
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
            {sign}
          </li>
        ))}
      </ul>
    </li>
  );
}

// Reading order follows need: 911, someone to talk to, poison and the family's
// own clinicians, then the signs that mean "get care now".
export default function HelpPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1760px] flex-1 flex-col gap-8 px-5 py-6 sm:px-8 sm:py-8 xl:gap-12 xl:px-12">
      <header className="flex items-center justify-between gap-4">
        <Suspense fallback={<BackLinkFallback />}>
          <BackLink />
        </Suspense>
        <span className="text-label text-muted-foreground">{PRODUCT_NAME}</span>
      </header>

      <h1 className="sr-only">Help now</h1>

      {/* DOM order is the phone reading order (911, talk, poison); at xl the grid
          puts poison under 911 and the talk lines beside both. */}
      <div className="grid gap-8 xl:grid-cols-12 xl:grid-rows-[auto_1fr] xl:gap-x-10 xl:gap-y-4">
        <section aria-labelledby="emergency" className="flex flex-col gap-5 xl:col-span-5 rounded-2xl border border-urgent/30 bg-urgent/5 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-urgent text-background">
              <Siren className="size-6" />
            </span>
            <h2 id="emergency" className="text-headline font-bold">
              In danger right now? Call 911.
            </h2>
          </div>
          <a
            href="tel:911"
            className="inline-flex min-h-20 w-full items-center justify-center gap-3 rounded-xl bg-urgent px-8 text-display font-bold text-background hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <Phone aria-hidden className="size-8" />
            Call <span className="font-mono">911</span>
          </a>
        </section>

        <section aria-labelledby="talk" className="flex flex-col gap-4 xl:col-span-7 xl:row-span-2">
          <h2 id="talk" className="text-headline">
            Need to talk to someone now?
          </h2>
          <div className="grid flex-1 gap-4 md:grid-cols-2">
            {TALK_LINES.map((line) => (
              <LineCard key={line.id} line={line} />
            ))}
          </div>
        </section>

        <div className="xl:col-span-5 xl:self-start">
          <PoisonRow line={POISON} />
        </div>
      </div>

      <Suspense fallback={null}>
        <CareTeam />
      </Suspense>

      <section aria-labelledby="signs" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="signs" className="text-headline">
            Get medical care right away if you have any of these
          </h2>
          <p className="text-body text-muted-foreground">This applies during pregnancy and in the year after birth.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {WARNING_SIGNS.map((group) => (
            <SignCard key={group.id} group={group} />
          ))}
        </ul>
      </section>
    </main>
  );
}
