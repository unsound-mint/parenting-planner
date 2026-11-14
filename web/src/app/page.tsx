import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product";
import { StartDemo } from "@/components/start-demo";

// Landing page. The jury must reach the working product in one click, no sign-up.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
      <p className="text-lg text-muted-foreground">{PRODUCT_TAGLINE}</p>
      <StartDemo template="pregnancy" label="Explore a family at 25 weeks" />
      <p className="text-sm text-muted-foreground">No sign-up. You get your own copy of a synthetic family.</p>
    </main>
  );
}
