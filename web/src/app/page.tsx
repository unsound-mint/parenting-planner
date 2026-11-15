import { PRODUCT_NAME } from "@/lib/product";
import { FamilyPicker } from "@/components/landing/family-picker";
import { HowToTry } from "@/components/landing/how-to-try";
import { SiteFooter } from "@/components/shell/site-footer";

// Landing page. In ten seconds a judge must see what the app does and be in a
// family, with no sign-up. The jury guide below says which screens to open in
// which order (docs/faq.md, Q52).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center gap-10 px-4 py-10 sm:px-6 md:py-16 lg:px-10">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-label text-primary">{PRODUCT_NAME}</p>
        <h1 className="text-headline md:text-display">One plan for both parents.</h1>
        <p className="text-body text-muted-foreground">
          What to do and when, from planning a baby to age 9, built from your own records and current guidelines.
          Pick a family to see it work.
        </p>
      </header>
      <section aria-label="Families to try" className="flex flex-col gap-3">
        <FamilyPicker />
        <p className="text-label font-normal text-muted-foreground">
          No sign-up. You get your own copy of a synthetic family, so everything you see is demo data. Switch between
          the parents inside.
        </p>
      </section>
      <HowToTry />
      <SiteFooter />
    </main>
  );
}
