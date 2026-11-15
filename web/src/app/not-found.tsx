import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/product";

export const metadata: Metadata = { title: "Page not found" };

// Any unknown path, including old family routes. /family opens This week.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-page flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <span className="text-label font-semibold tracking-tight">{PRODUCT_NAME}</span>
      <h1 className="mt-6 text-headline text-balance">We could not find that page</h1>
      <p className="mt-3 max-w-md text-body text-muted-foreground">The link may be old or mistyped. Your family and its plan are where you left them.</p>
      <Link
        href="/family"
        className="mt-8 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-label font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
      >
        Back to This week
      </Link>
    </main>
  );
}
