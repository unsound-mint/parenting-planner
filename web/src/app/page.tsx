import { PRODUCT_NAME } from "@/lib/product";
import { FamilyPicker } from "@/components/landing/family-picker";
import { HowToTry } from "@/components/landing/how-to-try";

// Landing page. The jury must reach the working product in one click, no sign-up,
// and be told which screens to open in which order (docs/faq.md, Q52).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-4 py-12 sm:px-6 md:py-24">
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-label text-primary">{PRODUCT_NAME}</p>
        <h1 className="text-headline md:text-display">One plan for both parents.</h1>
        <p className="text-body text-muted-foreground">
          What to do, and when, from planning a pregnancy to age 9. Based on current guidelines, with a source on every
          item.
        </p>
      </header>
      <div className="flex max-w-2xl flex-col gap-3">
        <FamilyPicker />
        <p className="text-label font-normal text-muted-foreground">
          No sign-up. You get your own copy of a synthetic family, so everything you see is demo data.
        </p>
      </div>
      <HowToTry />
    </main>
  );
}
