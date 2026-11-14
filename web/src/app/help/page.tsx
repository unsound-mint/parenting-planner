import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/product";

// Crisis and urgent-symptom screen. Rules, do not relax them:
// - Fixed text, the same for everyone. Never AI-generated, never read from the API or a cookie.
// - Never animated: no Motion, no CSS transitions (docs/design.md, "Motion and delight").
// - Static server component, prerendered at build time.
// - Wording is owned by Dayana (#182). Numbers and sources were verified on Nov 14 2026;
//   re-check them before changing anything here.
export const metadata: Metadata = {
  title: "Help now",
};

const CHECKED = "checked Nov 14 2026";

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

const actionClass =
  "inline-flex min-h-14 items-center justify-center rounded-lg border border-border bg-background px-5 text-lg font-semibold text-foreground underline-offset-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Source({ href, label }: { href: string; label: string }) {
  return (
    <p className="font-mono text-sm text-muted-foreground">
      Source:{" "}
      <a href={href} className="underline underline-offset-4">
        {label}
      </a>
      , {CHECKED}
    </p>
  );
}

export default function HelpPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4 text-sm">
        <Link
          href="/family"
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Back
        </Link>
        <span className="text-muted-foreground">{PRODUCT_NAME}</span>
      </header>

      <h1 className="sr-only">Help now</h1>

      <section
        aria-labelledby="emergency"
        className="flex flex-col gap-4 rounded-xl border-2 border-urgent p-5 sm:p-6"
      >
        <h2
          id="emergency"
          className="text-3xl font-bold tracking-tight text-urgent sm:text-4xl"
        >
          In danger right now? Call 911.
        </h2>
        <a
          href="tel:911"
          className="inline-flex min-h-20 items-center justify-center rounded-lg bg-urgent px-6 font-mono text-4xl font-bold text-background underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Call 911
        </a>
      </section>

      <section
        aria-labelledby="crisis"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="crisis" className="text-xl font-semibold">
          Thoughts of harming yourself or your baby
        </h2>
        <p>
          988 Suicide &amp; Crisis Lifeline. Call or text 988, any time, day or
          night.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="tel:988" className={actionClass}>
            Call <span className="ml-2 font-mono">988</span>
          </a>
          <a href="sms:988" className={actionClass}>
            Text <span className="ml-2 font-mono">988</span>
          </a>
        </div>
        <Source href="https://988lifeline.org/" label="988lifeline.org" />
      </section>

      <section
        aria-labelledby="maternal"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="maternal" className="text-xl font-semibold">
          National Maternal Mental Health Hotline
        </h2>
        <p>
          <span className="font-mono">1-833-TLC-MAMA (1-833-852-6262)</span>.
          Call or text, 24/7, free and confidential, in English and Spanish.
        </p>
        <p className="text-muted-foreground">
          This is not an emergency line. If you are in danger, call 911.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="tel:18338526262" className={actionClass}>
            Call <span className="ml-2 font-mono">1-833-852-6262</span>
          </a>
          <a href="sms:18338526262" className={actionClass}>
            Text <span className="ml-2 font-mono">1-833-852-6262</span>
          </a>
        </div>
        <Source
          href="https://mchb.hrsa.gov/national-maternal-mental-health-hotline"
          label="mchb.hrsa.gov"
        />
      </section>

      <section
        aria-labelledby="poison"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="poison" className="text-xl font-semibold">
          Poison Control
        </h2>
        <p>Open 24/7.</p>
        <a href="tel:18002221222" className={actionClass}>
          Call <span className="ml-2 font-mono">1-800-222-1222</span>
        </a>
      </section>

      <section
        aria-labelledby="signs"
        className="flex flex-col gap-3 rounded-xl border border-urgent/40 p-5"
      >
        <h2 id="signs" className="text-xl font-semibold text-urgent">
          Get medical care right away if you have any of these
        </h2>
        <p className="text-muted-foreground">
          This applies during pregnancy and in the year after birth.
        </p>
        <ul className="flex flex-col divide-y divide-border">
          {WARNING_SIGNS.map((sign) => (
            <li key={sign} className="py-2.5">
              {sign}
            </li>
          ))}
        </ul>
        <Source
          href="https://www.cdc.gov/hearher/maternal-warning-signs/index.html"
          label="CDC Hear Her campaign"
        />
      </section>

      <p className="pt-2 text-sm text-muted-foreground">
        This page is the same for everyone. It is never written by AI.
      </p>
    </main>
  );
}
