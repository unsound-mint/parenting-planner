import type { Metadata } from "next";
import { Suspense } from "react";
import { FlaskConical, HeartHandshake, MessageSquare, Phone, Siren, TriangleAlert, type LucideIcon } from "lucide-react";
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
export const metadata: Metadata = {
  title: "Help now",
};

const WARNING_SIGNS = [
  "Headache that won't go away or gets worse over time",
  "Dizziness or fainting",
  "Changes in your vision",
  "Fever of 100.4°F or higher",
  "Extreme swelling of your hands or face",
  "Thoughts about harming yourself or your baby",
  "Trouble breathing",
  "Chest pain or fast-beating heart",
  "Severe nausea and throwing up",
  "Severe belly pain that doesn't go away",
  "Baby's movement stopping or slowing during pregnancy",
  "Vaginal bleeding or fluid leaking during pregnancy",
  "Vaginal bleeding or discharge after pregnancy",
  "Severe swelling, redness, or pain of your leg or arm",
  "Overwhelming tiredness",
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

const LINES: Line[] = [
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
  {
    id: "poison",
    icon: FlaskConical,
    title: "Poison Control",
    body: "Open 24/7, free and confidential.",
    note: "If the person collapses, has a seizure, has trouble breathing or can't be woken up, call 911 now.",
    display: "1-800-222-1222",
    dial: "18002221222",
    text: false,
  },
];

const actionClass =
  "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-body font-semibold whitespace-nowrap text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function LineCard({ line }: { line: Line }) {
  const Icon = line.icon;
  return (
    <section aria-labelledby={line.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={line.id} className="text-title font-semibold">
            {line.title}
          </h2>
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

export default function HelpPage() {
  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8 xl:px-12">
      <header className="flex items-center justify-between gap-4">
        <Suspense fallback={<BackLinkFallback />}>
          <BackLink />
        </Suspense>
        <span className="text-label text-muted-foreground">{PRODUCT_NAME}</span>
      </header>

      <h1 className="sr-only">Help now</h1>

      <section
        aria-labelledby="emergency"
        className="flex flex-col gap-4 rounded-xl border-2 border-urgent p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <span aria-hidden className="hidden size-14 shrink-0 items-center justify-center rounded-full bg-urgent text-background sm:flex">
            <Siren className="size-7" />
          </span>
          <h2 id="emergency" className="text-headline font-bold text-urgent">
            In danger right now? Call 911.
          </h2>
        </div>
        <a
          href="tel:911"
          className="inline-flex min-h-20 items-center justify-center gap-3 rounded-lg bg-urgent px-8 text-display font-bold text-background hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground lg:min-w-80"
        >
          <Phone aria-hidden className="size-8" />
          Call <span className="font-mono">911</span>
        </a>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {LINES.map((line) => (
          <LineCard key={line.id} line={line} />
        ))}
      </div>

      <Suspense fallback={null}>
        <CareTeam />
      </Suspense>

      <section aria-labelledby="signs" className="flex flex-col gap-3 rounded-xl border border-urgent/40 p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-urgent/10 text-urgent">
            <TriangleAlert className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="signs" className="text-title font-semibold text-urgent">
              Get medical care right away if you have any of these
            </h2>
            <p className="text-label text-muted-foreground">This applies during pregnancy and in the year after birth.</p>
          </div>
        </div>
        <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
          {WARNING_SIGNS.map((sign) => (
            <li key={sign} className="flex items-start gap-3 border-b border-border py-2.5 text-body">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-urgent" />
              {sign}
            </li>
          ))}
        </ul>
      </section>

    </main>
  );
}
