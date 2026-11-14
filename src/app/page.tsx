import { startDemo } from "@/server/actions";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product";

// Landing page. The jury must reach the working product in one click, no sign-up.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">{PRODUCT_TAGLINE}</p>
      <form action={startDemo}>
        <button className="rounded-full bg-foreground px-6 py-3 font-medium text-background">
          Try the demo family
        </button>
      </form>
      <p className="text-sm text-zinc-500">No sign-up. You get your own family with synthetic data.</p>
    </main>
  );
}
